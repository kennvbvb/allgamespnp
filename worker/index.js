/* ============================================================
   Cloudflare Worker — ล็อกอิน GitHub ให้หน้า admin ไม่ต้องวาง token เอง

   แนวคิดด้านความปลอดภัย:
   - เบราว์เซอร์ "ไม่เคยถือ" GitHub token เลย — token ถูกเข้ารหัส (AES-GCM)
     เก็บใน cookie แบบ HttpOnly ที่ JavaScript อ่านไม่ได้
   - worker เป็นคนคุยกับ GitHub API แทน และล็อกไว้ที่ repo เดียว + ไฟล์ที่อนุญาต
     เท่านั้น (แม้ session หลุด ก็แก้ไฟล์อื่น/แก้ workflow ไม่ได้)
   - อนุญาตเฉพาะ GitHub username ที่อยู่ใน ALLOWED_LOGINS
   - ตรวจ Origin ทุก request ที่เปลี่ยนข้อมูล (กัน CSRF เพราะ cookie เป็น
     SameSite=None ตามที่จำเป็นสำหรับ cross-site fetch)

   ตัวแปรที่ต้องตั้ง (ดู README.md ในโฟลเดอร์นี้):
     GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET,
     ALLOWED_LOGINS, SITE_ORIGIN, REPO_OWNER, REPO_NAME
   ============================================================ */

const COOKIE_NAME = "ghsess";
const SESSION_TTL = 60 * 60 * 8; // 8 ชั่วโมง (พอสำหรับหนึ่งวันทำงาน)
const STATE_TTL = 60 * 10; // state ของ OAuth ใช้ได้ 10 นาที
// ไฟล์ที่ยอมให้แก้ผ่าน worker — กันไม่ให้ไปแก้ workflow หรือโค้ดเว็บ
const ALLOWED_PATHS = ["games.js", "announcement.js"];

// ---------- ตัวช่วยเข้ารหัส ----------
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function aesKey(secret) {
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

// เข้ารหัสอ็อบเจกต์ → ข้อความสั้นๆ ที่ปลอมไม่ได้และอ่านไม่ออก
async function seal(obj, secret) {
  const key = await aesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = enc.encode(JSON.stringify(obj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64urlEncode(out);
}

async function unseal(token, secret) {
  try {
    const raw = b64urlDecode(token);
    const key = await aesKey(secret);
    const iv = raw.slice(0, 12);
    const ct = raw.slice(12);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    const obj = JSON.parse(dec.decode(pt));
    if (obj.exp && obj.exp < Math.floor(Date.now() / 1000)) return null; // หมดอายุ
    return obj;
  } catch (e) {
    return null; // ถอดไม่ได้ = ถูกแก้ หรือ secret เปลี่ยน
  }
}

// ---------- HTTP helpers ----------
function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.SITE_ORIGIN,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(body, env, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(env), ...extra },
  });
}

function cookieHeader(value, maxAge) {
  // SameSite=None จำเป็น เพราะหน้า admin (github.io) กับ worker (workers.dev) ต่าง site
  // จึงต้องคู่กับการตรวจ Origin ทุก request ที่เปลี่ยนข้อมูล
  return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAge}`;
}

function readCookie(req) {
  const raw = req.headers.get("Cookie") || "";
  const hit = raw.split(/;\s*/).find((c) => c.startsWith(COOKIE_NAME + "="));
  return hit ? hit.slice(COOKIE_NAME.length + 1) : null;
}

async function session(req, env) {
  const c = readCookie(req);
  return c ? await unseal(c, env.SESSION_SECRET) : null;
}

// ทุก request ที่เปลี่ยนข้อมูลต้องมาจากเว็บของเราเท่านั้น (กัน CSRF)
function originOk(req, env) {
  const o = req.headers.get("Origin");
  return o === env.SITE_ORIGIN;
}

// ---------- GitHub API (ฝั่ง worker) ----------
function ghHeaders(token) {
  return {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "allgamespnp-admin-worker",
  };
}

function contentsUrl(env, path) {
  return `https://api.github.com/repos/${env.REPO_OWNER}/${env.REPO_NAME}/contents/${path}`;
}

// ---------- Routes ----------
async function handleLogin(url, env) {
  const state = await seal(
    { n: b64urlEncode(crypto.getRandomValues(new Uint8Array(16))), exp: Math.floor(Date.now() / 1000) + STATE_TTL },
    env.SESSION_SECRET
  );
  const auth = new URL("https://github.com/login/oauth/authorize");
  auth.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  auth.searchParams.set("redirect_uri", url.origin + "/auth/callback");
  auth.searchParams.set("scope", "public_repo"); // พอสำหรับ commit ไฟล์ใน repo สาธารณะ
  auth.searchParams.set("state", state);
  auth.searchParams.set("allow_signup", "false");
  return Response.redirect(auth.toString(), 302);
}

// หน้าจบการล็อกอิน: ส่งกลับหน้า admin พร้อมบอกผลสั้นๆ
function backToAdmin(env, ok, reason) {
  // ต้องอยู่ใต้ SITE_ORIGIN เท่านั้น กันการถูกหลอกให้ redirect ออกนอกเว็บ
  const admin = env.SITE_ADMIN_URL && env.SITE_ADMIN_URL.startsWith(env.SITE_ORIGIN)
    ? env.SITE_ADMIN_URL
    : env.SITE_ORIGIN + "/admin.html";
  const to = new URL(admin);
  to.searchParams.set("login", ok ? "ok" : "fail");
  if (reason) to.searchParams.set("reason", reason);
  return Response.redirect(to.toString(), 302);
}

async function handleCallback(req, url, env) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !(await unseal(state, env.SESSION_SECRET))) {
    return backToAdmin(env, false, "state");
  }

  // แลก code เป็น access token (client_secret อยู่ฝั่ง server เท่านั้น)
  const tokRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "allgamespnp-admin-worker" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: url.origin + "/auth/callback",
    }),
  });
  const tok = await tokRes.json().catch(() => ({}));
  if (!tok.access_token) return backToAdmin(env, false, "token");

  // ดูว่าใครล็อกอิน แล้วเทียบกับรายชื่อที่อนุญาต
  const meRes = await fetch("https://api.github.com/user", { headers: ghHeaders(tok.access_token) });
  const me = await meRes.json().catch(() => ({}));
  const allowed = (env.ALLOWED_LOGINS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!me.login || !allowed.includes(String(me.login).toLowerCase())) {
    return backToAdmin(env, false, "notallowed");
  }

  const sess = await seal(
    { login: me.login, token: tok.access_token, exp: Math.floor(Date.now() / 1000) + SESSION_TTL },
    env.SESSION_SECRET
  );
  const res = backToAdmin(env, true);
  const out = new Response(res.body, res);
  out.headers.append("Set-Cookie", cookieHeader(sess, SESSION_TTL));
  return out;
}

async function handleGetFile(req, url, env, sess) {
  const path = url.searchParams.get("path") || "";
  if (!ALLOWED_PATHS.includes(path)) return json({ error: "path ไม่ได้รับอนุญาต" }, env, 400);
  const ref = url.searchParams.get("ref") || "main";
  const api = contentsUrl(env, path) + "?ref=" + encodeURIComponent(ref);
  const r = await fetch(api, { headers: ghHeaders(sess.token) });
  if (r.status === 404) return json({ sha: null, text: null }, env);
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    return json({ error: `โหลดไฟล์ไม่สำเร็จ (${r.status}) ${e.message || ""}` }, env, 502);
  }
  const j = await r.json();
  // ส่งเนื้อไฟล์เป็นข้อความ (worker ถอด base64 ให้ รวมภาษาไทยถูกต้อง)
  const text = j.content ? dec.decode(b64ToBytes(j.content)) : null;
  return json({ sha: j.sha, text }, env);
}

function b64ToBytes(b64) {
  const raw = atob(b64.replace(/\s/g, ""));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function bytesToB64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

// ประวัติการแก้ไขไฟล์ — ส่งกลับเฉพาะที่หน้า admin ต้องใช้
// (ไม่ส่ง payload ดิบของ GitHub ต่อ จะได้ไม่หลุดข้อมูลเกินจำเป็น เช่น อีเมลผู้แก้)
async function handleHistory(req, url, env, sess) {
  const path = url.searchParams.get("path") || "";
  if (!ALLOWED_PATHS.includes(path)) return json({ error: "path ไม่ได้รับอนุญาต" }, env, 400);
  const ref = url.searchParams.get("ref") || "main";
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit"), 10) || 10, 1), 30);
  const api = `https://api.github.com/repos/${env.REPO_OWNER}/${env.REPO_NAME}/commits` +
    `?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(ref)}&per_page=${limit}`;
  const r = await fetch(api, { headers: ghHeaders(sess.token) });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    return json({ error: `โหลดประวัติไม่สำเร็จ (${r.status}) ${e.message || ""}` }, env, 502);
  }
  const list = await r.json().catch(() => []);
  const commits = (Array.isArray(list) ? list : []).map((x) => ({
    sha: x.sha,
    date: x.commit?.author?.date || "",
    login: x.author?.login || x.commit?.author?.name || "",
    message: x.commit?.message || "",
  }));
  return json({ commits }, env);
}

async function handleCommit(req, env, sess) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.path !== "string" || typeof body.text !== "string") {
    return json({ error: "ข้อมูลไม่ครบ" }, env, 400);
  }
  if (!ALLOWED_PATHS.includes(body.path)) return json({ error: "path ไม่ได้รับอนุญาต" }, env, 400);

  const payload = {
    message: String(body.message || "อัปเดตผ่านหน้า admin"),
    content: bytesToB64(enc.encode(body.text)),
    branch: String(body.branch || "main"),
  };
  if (body.sha) payload.sha = String(body.sha);

  const r = await fetch(contentsUrl(env, body.path), {
    method: "PUT",
    headers: { ...ghHeaders(sess.token), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: `commit ไม่สำเร็จ (${r.status}) ${j.message || ""}` }, env, 502);
  return json(j, env);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(env) });

    if (p === "/auth/login") return handleLogin(url, env);
    if (p === "/auth/callback") return handleCallback(req, url, env);

    if (p === "/auth/logout") {
      if (!originOk(req, env)) return json({ error: "origin ไม่ถูกต้อง" }, env, 403);
      return json({ ok: true }, env, 200, { "Set-Cookie": cookieHeader("", 0) });
    }

    const sess = await session(req, env);

    if (p === "/api/me") {
      if (!sess) return json({ error: "ยังไม่ได้ล็อกอิน" }, env, 401);
      return json({ login: sess.login, repo: `${env.REPO_OWNER}/${env.REPO_NAME}` }, env);
    }

    if (p === "/api/file" && req.method === "GET") {
      if (!sess) return json({ error: "ยังไม่ได้ล็อกอิน" }, env, 401);
      if (!originOk(req, env)) return json({ error: "origin ไม่ถูกต้อง" }, env, 403);
      return handleGetFile(req, url, env, sess);
    }

    if (p === "/api/history" && req.method === "GET") {
      if (!sess) return json({ error: "ยังไม่ได้ล็อกอิน" }, env, 401);
      if (!originOk(req, env)) return json({ error: "origin ไม่ถูกต้อง" }, env, 403);
      return handleHistory(req, url, env, sess);
    }

    if (p === "/api/commit" && req.method === "POST") {
      if (!sess) return json({ error: "ยังไม่ได้ล็อกอิน" }, env, 401);
      if (!originOk(req, env)) return json({ error: "origin ไม่ถูกต้อง" }, env, 403);
      return handleCommit(req, env, sess);
    }

    return json({ error: "ไม่พบเส้นทางนี้" }, env, 404);
  },
};
