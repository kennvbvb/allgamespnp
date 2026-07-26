// ตรวจว่าลิงก์เกมทั้งหมดใน games.js ยังใช้งานได้ (ไม่ 4xx/5xx และไม่เด้งไปหน้า sign-in)
// รันด้วย Node 20+ (มี global fetch): `node scripts/check-links.mjs`
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dir, "..", "games.js"), "utf8");

// โหลด GAMES โดยไม่ต้องมี DOM
const win = {};
// eslint-disable-next-line no-new-func
const load = new Function("window", src + "\nreturn window.GAMES;");
const games = load(win) || [];

if (!Array.isArray(games) || games.length === 0) {
  console.error("อ่าน games.js ไม่ได้ หรือไม่มีเกม");
  process.exit(1);
}

const SIGN_IN = /accounts\.google\.com|ServiceLogin|\/signin|permission|authuser/i;
const TIMEOUT_MS = 20000;

async function check(game) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(game.url, { redirect: "follow", signal: ctrl.signal });
    const finalUrl = res.url || "";
    const signIn = SIGN_IN.test(finalUrl);
    if (!res.ok || signIn) {
      return { ok: false, msg: `HTTP ${res.status}${signIn ? " (เด้งไปหน้า sign-in/permission)" : ""}` };
    }
    return { ok: true, msg: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, msg: e.name === "AbortError" ? "timeout" : e.message };
  } finally {
    clearTimeout(t);
  }
}

let failed = 0;
for (const game of games) {
  if (!game || typeof game.url !== "string") { console.error(`✗ ${game && game.title}: ไม่มี url`); failed++; continue; }
  const r = await check(game);
  if (r.ok) console.log(`✓ ${game.title} — ${r.msg}`);
  else { console.error(`✗ ${game.title} — ${r.msg}\n    ${game.url}`); failed++; }
}

console.log("");
if (failed) {
  console.error(`พบลิงก์มีปัญหา ${failed}/${games.length} เกม`);
  process.exit(1);
}
console.log(`ทุกลิงก์ปกติ (${games.length} เกม)`);
