/* ============================================================
   เทสต์ worker ล็อกอิน — รันด้วย `node worker/test.mjs` (Node 20+)
   เน้นจุดที่พลาดแล้วอันตราย: การตรวจ session, รายชื่อไฟล์ที่แก้ได้,
   การกัน CSRF ด้วย Origin, และ token ต้องไม่รั่วออกไปให้เบราว์เซอร์
   ============================================================ */
import worker from "./index.js";
const env = {
  GITHUB_CLIENT_ID: "cid", GITHUB_CLIENT_SECRET: "csecret",
  SESSION_SECRET: "secret-for-test-1234567890",
  ALLOWED_LOGINS: "kennvbvb, someoneelse",
  SITE_ORIGIN: "https://kennvbvb.github.io",
  SITE_ADMIN_URL: "https://kennvbvb.github.io/allgamespnp/admin.html",
  REPO_OWNER: "kennvbvb", REPO_NAME: "allgamespnp",
};
const W = "https://w.workers.dev";
const call = (p, o={}) => worker.fetch(new Request(W + p, o), env);
let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log("✓",m);} else {fail++;console.log("✗",m);} };

// ---- สร้าง cookie session ที่ "ถูกต้อง" ด้วยอัลกอริทึมเดียวกับ worker ----
const enc = new TextEncoder();
const b64url = (b) => Buffer.from(b).toString("base64url");
async function seal(obj, secret) {
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  const key = await crypto.subtle.importKey("raw", hash, {name:"AES-GCM"}, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv}, key, enc.encode(JSON.stringify(obj))));
  const out = new Uint8Array(12+ct.length); out.set(iv); out.set(ct,12);
  return b64url(out);
}
const good = await seal({login:"kennvbvb", token:"gho_TESTTOKEN", exp: Math.floor(Date.now()/1000)+600}, env.SESSION_SECRET);
const expired = await seal({login:"kennvbvb", token:"gho_X", exp: Math.floor(Date.now()/1000)-10}, env.SESSION_SECRET);
const wrongSecret = await seal({login:"kennvbvb", token:"gho_X", exp: Math.floor(Date.now()/1000)+600}, "อีก secret");
const H = { Cookie: "ghsess="+good, Origin: env.SITE_ORIGIN };

// cookie ปลอม / หมดอายุ / secret ผิด
ok((await call("/api/me", {headers:{Cookie:"ghsess=bogus-value"}})).status === 401, "cookie ปลอม → 401");
ok((await call("/api/me", {headers:{Cookie:"ghsess="+expired}})).status === 401, "cookie หมดอายุ → 401");
ok((await call("/api/me", {headers:{Cookie:"ghsess="+wrongSecret}})).status === 401, "cookie เซ็นด้วย secret อื่น → 401");

// cookie ถูก → /api/me บอกชื่อ + repo
let r = await call("/api/me", {headers:H});
let j = await r.json();
ok(r.status===200 && j.login==="kennvbvb" && j.repo==="kennvbvb/allgamespnp", "/api/me cookie ถูก → คืน login+repo");
ok(!JSON.stringify(j).includes("gho_"), "/api/me ไม่รั่ว token ออกมาให้เบราว์เซอร์");

// ---- ดัก fetch ไป GitHub เพื่อดูว่า worker ส่งอะไร ----
let ghCalls = [];
globalThis.fetch = async (url, opts={}) => {
  ghCalls.push({ url: String(url), method: opts.method||"GET", body: opts.body, headers: opts.headers });
  return new Response(JSON.stringify({ sha:"abc", content: Buffer.from("สวัสดีไทย","utf8").toString("base64"), commit:{html_url:"u"} }),
    { status:200, headers:{"Content-Type":"application/json"} });
};

// path ที่อนุญาต → ผ่านไป GitHub
ghCalls=[];
r = await call("/api/file?path=games.js&ref=main", {headers:H});
j = await r.json();
ok(r.status===200 && ghCalls.length===1, "/api/file games.js → เรียก GitHub");
ok(ghCalls[0].url.includes("/repos/kennvbvb/allgamespnp/contents/games.js"), "ยิงไป repo ที่ล็อกไว้เท่านั้น");
ok(j.text==="สวัสดีไทย", "ถอด base64 เป็นภาษาไทยถูกต้อง");
ok(String(ghCalls[0].headers.Authorization).includes("gho_TESTTOKEN"), "worker แนบ token ฝั่ง server");

// path ที่ไม่อนุญาต → ปฏิเสธก่อนถึง GitHub
for (const bad of [".github/workflows/ci.yml", "admin.js", "../secrets", "index.html"]) {
  ghCalls=[];
  r = await call("/api/file?path="+encodeURIComponent(bad), {headers:H});
  ok(r.status===400 && ghCalls.length===0, `/api/file "${bad}" → 400 ไม่แตะ GitHub`);
  ghCalls=[];
  r = await call("/api/commit", {method:"POST", headers:{...H,"Content-Type":"application/json"},
    body: JSON.stringify({path:bad, text:"x"})});
  ok(r.status===400 && ghCalls.length===0, `/api/commit "${bad}" → 400 ไม่แตะ GitHub`);
}

// commit ไฟล์ที่อนุญาต → ส่ง PUT พร้อม sha + เนื้อหา base64
ghCalls=[];
r = await call("/api/commit", {method:"POST", headers:{...H,"Content-Type":"application/json"},
  body: JSON.stringify({path:"announcement.js", text:"ประกาศไทย", sha:"oldsha", message:"m", branch:"main"})});
ok(r.status===200 && ghCalls[0].method==="PUT", "/api/commit → PUT ไป GitHub");
const sent = JSON.parse(ghCalls[0].body);
ok(sent.sha==="oldsha" && sent.branch==="main" && sent.message==="m", "ส่ง sha/branch/message ครบ (conflict detection ยังทำงาน)");
ok(Buffer.from(sent.content,"base64").toString("utf8")==="ประกาศไทย", "encode ภาษาไทยเป็น base64 ถูกต้อง");

// ---- /api/history (ประวัติการแก้ไข) ----
// ไม่มี session → 401 และต้องไม่แตะ GitHub เลย
ghCalls=[];
r = await call("/api/history?path=games.js&ref=main", {headers:{Origin:env.SITE_ORIGIN}});
ok(r.status===401 && ghCalls.length===0, "/api/history ไม่มี session → 401 ไม่แตะ GitHub");

// cookie ถูกแต่ Origin ผิด → 403 (กัน CSRF เหมือนเส้นทางอื่น)
ghCalls=[];
r = await call("/api/history?path=games.js", {headers:{Cookie:"ghsess="+good, Origin:"https://evil.example"}});
ok(r.status===403 && ghCalls.length===0, "/api/history Origin ผิด → 403");

// path นอกรายการที่อนุญาต → 400 ก่อนถึง GitHub
for (const bad of [".github/workflows/ci.yml", "admin.js", "../secrets"]) {
  ghCalls=[];
  r = await call("/api/history?path="+encodeURIComponent(bad), {headers:H});
  ok(r.status===400 && ghCalls.length===0, `/api/history "${bad}" → 400 ไม่แตะ GitHub`);
}

// เส้นทางปกติ: คืนเฉพาะฟิลด์ที่หน้า admin ใช้ ไม่ส่ง payload ดิบต่อ
globalThis.fetch = async (url, opts={}) => {
  ghCalls.push({ url: String(url), method: opts.method||"GET" });
  return new Response(JSON.stringify([
    { sha:"sha1", commit:{ author:{ date:"2026-07-30T02:00:00Z", name:"ครู", email:"secret@example.com" }, message:"อัปเดตรายการเกม" },
      author:{ login:"kennvbvb" } },
  ]), { status:200, headers:{"Content-Type":"application/json"} });
};
ghCalls=[];
r = await call("/api/history?path=games.js&ref=main&limit=5", {headers:H});
j = await r.json();
ok(r.status===200 && j.commits.length===1 && j.commits[0].sha==="sha1", "/api/history คืนรายการ commit");
ok(ghCalls[0].url.includes("/repos/kennvbvb/allgamespnp/commits") && ghCalls[0].url.includes("per_page=5"),
  "/api/history ยิงไป repo ที่ล็อกไว้ + ส่ง per_page ตามที่ขอ");
ok(!JSON.stringify(j).includes("secret@example.com"), "/api/history ไม่ส่งอีเมลผู้แก้ต่อให้เบราว์เซอร์");

// limit ต้องถูกจำกัดเพดาน กันขอทีเดียวเป็นพัน
ghCalls=[];
await call("/api/history?path=games.js&limit=9999", {headers:H});
ok(ghCalls[0].url.includes("per_page=30"), "/api/history จำกัด limit ไว้ที่ 30");

// Origin ผิด → 403 แม้ cookie ถูก
ghCalls=[];
r = await call("/api/commit", {method:"POST", headers:{Cookie:"ghsess="+good, Origin:"https://evil.example","Content-Type":"application/json"},
  body: JSON.stringify({path:"games.js", text:"x"})});
ok(r.status===403 && ghCalls.length===0, "cookie ถูกแต่ Origin ผิด → 403 (กัน CSRF)");

console.log(`\nผ่าน ${pass} / ไม่ผ่าน ${fail}`);
process.exit(fail?1:0);
