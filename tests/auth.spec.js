// @ts-check
const { test, expect } = require("@playwright/test");

const GAMES = `window.GAMES=[
  {id:"a",title:"เกม A",subject:"สังคมศึกษาฯ",grades:["ป.4"],url:"https://script.google.com/a/exec"}
];`;
const WORKER = "https://fake-worker.workers.dev";

async function stub(page) {
  await page.route("**/games.js", (r) =>
    r.fulfill({ contentType: "application/javascript", body: GAMES })
  );
  await page.route("**/announcement.js", (r) =>
    r.fulfill({ contentType: "application/javascript", body: "window.ANNOUNCEMENT={enabled:false};" })
  );
}

test.describe("F — โหมดล็อกอินผ่าน worker", () => {
  test("ไม่ตั้งค่า worker → ใช้โหมด token เหมือนเดิม", async ({ page }) => {
    await stub(page);
    await page.goto("/admin.html");
    await expect(page.locator("#tokenBox")).toBeVisible();
    await expect(page.locator("#authBox")).toBeHidden();
    await expect(page.locator("#cfgToken")).toBeVisible();
  });

  test("ตั้งค่า worker → ซ่อนช่อง token, โชว์ปุ่มล็อกอิน, จำค่าไว้", async ({ page }) => {
    await stub(page);
    // ยังไม่ล็อกอิน → worker ตอบ 401
    await page.route(WORKER + "/api/me", (r) =>
      r.fulfill({ status: 401, contentType: "application/json", body: '{"error":"ยังไม่ได้ล็อกอิน"}' })
    );
    await page.goto("/admin.html");

    // ช่องนี้อยู่ใน "ตั้งค่าขั้นสูง" ที่พับไว้ — ครูต้องกางก่อน
    await page.locator("details.advanced summary").click();
    await page.fill("#cfgWorker", WORKER);
    await page.locator("#cfgWorker").dispatchEvent("change");

    await expect(page.locator("#authBox")).toBeVisible();
    await expect(page.locator("#tokenBox")).toBeHidden();
    await expect(page.locator("#btnLogin")).toBeVisible();
    await expect(page.locator("#btnLogout")).toBeHidden();
    await expect(page.locator("#authState")).toContainText("ยังไม่ได้ล็อกอิน");

    // จำค่าไว้ใน localStorage → เปิดใหม่ยังอยู่ในโหมดล็อกอิน
    await page.reload();
    await expect(page.locator("#authBox")).toBeVisible();
    await page.locator("details.advanced summary").click();
    await expect(page.locator("#cfgWorker")).toHaveValue(WORKER);
  });

  test("ล็อกอินแล้ว → บอกชื่อผู้ใช้ + ดึงข้อมูลผ่าน worker (ไม่ใช้ token)", async ({ page }) => {
    await stub(page);
    await page.route(WORKER + "/api/me", (r) =>
      r.fulfill({ contentType: "application/json", body: '{"login":"kennvbvb","repo":"kennvbvb/allgamespnp"}' })
    );
    // worker คืนไฟล์ games.js ที่มี 2 เกม (ต่างจากที่ bundle มากับหน้า)
    await page.route(WORKER + "/api/file**", (r) =>
      r.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          sha: "sha123",
          text: `const GAMES = [
  {"id":"x","title":"เกมจาก worker 1","description":"","subject":"ส","grades":["ป.4"],"url":"https://script.google.com/x/exec"},
  {"id":"y","title":"เกมจาก worker 2","description":"","subject":"ส","grades":["ป.5"],"url":"https://script.google.com/y/exec"}
];

window.GAMES = GAMES;`,
        }),
      })
    );

    await page.addInitScript((w) => {
      localStorage.setItem("gamehub_gh_cfg", JSON.stringify({ owner: "kennvbvb", repo: "allgamespnp", branch: "main", path: "games.js", worker: w }));
    }, WORKER);
    await page.goto("/admin.html");

    await expect(page.locator("#authState")).toContainText("ล็อกอินเป็น kennvbvb");
    await expect(page.locator("#btnLogout")).toBeVisible();
    await expect(page.locator("#btnLogin")).toBeHidden();
    // โหลดข้อมูลล่าสุดผ่าน worker สำเร็จ (รายการเปลี่ยนเป็นของ worker)
    await expect(page.locator(".li-title")).toHaveText(["เกมจาก worker 1", "เกมจาก worker 2"]);
    // ไม่มี token ในเครื่องเลย
    expect(await page.evaluate(() => sessionStorage.getItem("gamehub_gh_token"))).toBeNull();
  });

  test("บันทึกขึ้นเว็บผ่าน worker — ส่ง path/sha/branch ครบ", async ({ page }) => {
    await stub(page);
    await page.route(WORKER + "/api/me", (r) =>
      r.fulfill({ contentType: "application/json", body: '{"login":"kennvbvb"}' })
    );
    await page.route(WORKER + "/api/file**", (r) =>
      r.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          sha: "basesha",
          text: 'const GAMES = [\n  {"id":"x","title":"เดิม","description":"","subject":"ส","grades":["ป.4"],"url":"https://script.google.com/x/exec"}\n];\n\nwindow.GAMES = GAMES;',
        }),
      })
    );
    let commitBody = null;
    await page.route(WORKER + "/api/commit", (r) => {
      commitBody = JSON.parse(r.request().postData() || "{}");
      r.fulfill({ contentType: "application/json", body: '{"content":{"sha":"newsha"},"commit":{"html_url":"https://github.com/x"}}' });
    });

    await page.addInitScript((w) => {
      localStorage.setItem("gamehub_gh_cfg", JSON.stringify({ owner: "kennvbvb", repo: "allgamespnp", branch: "main", path: "games.js", worker: w }));
    }, WORKER);
    await page.goto("/admin.html");
    await expect(page.locator(".li-title")).toHaveText(["เดิม"]);

    // แก้ลำดับ/ข้อมูลอะไรก็ได้ให้ dirty แล้วกดบันทึก
    await page.locator('.admin-list-item input[data-act="select"]').check();
    await page.fill("#bulkTagInput", "ทดสอบ");
    await page.locator("#bulkTagAdd").click();
    await page.locator("#btnCommit").click();

    await expect(page.locator("#commitStatus")).toContainText("บันทึกสำเร็จ");
    expect(commitBody.path).toBe("games.js");
    expect(commitBody.branch).toBe("main");
    expect(commitBody.sha).toBe("basesha"); // conflict detection ยังทำงาน
    expect(commitBody.text).toContain("ทดสอบ");
  });

  test("ยังไม่ล็อกอินแล้วกดบันทึก → เตือนให้ล็อกอินก่อน (ไม่ขอ token)", async ({ page }) => {
    await stub(page);
    await page.route(WORKER + "/api/me", (r) => r.fulfill({ status: 401, contentType: "application/json", body: "{}" }));
    await page.addInitScript((w) => {
      localStorage.setItem("gamehub_gh_cfg", JSON.stringify({ owner: "kennvbvb", repo: "allgamespnp", branch: "main", path: "games.js", worker: w }));
    }, WORKER);
    await page.goto("/admin.html");

    await page.locator("#btnCommit").click();
    await expect(page.locator("#commitStatus")).toContainText("ยังไม่ได้ล็อกอิน");
  });

  test("กลับมาจากล็อกอินไม่สำเร็จ → บอกเหตุผลเป็นภาษาคน", async ({ page }) => {
    await stub(page);
    await page.route(WORKER + "/api/me", (r) => r.fulfill({ status: 401, contentType: "application/json", body: "{}" }));
    await page.addInitScript((w) => {
      localStorage.setItem("gamehub_gh_cfg", JSON.stringify({ owner: "kennvbvb", repo: "allgamespnp", branch: "main", path: "games.js", worker: w }));
    }, WORKER);
    await page.goto("/admin.html?login=fail&reason=notallowed");
    await expect(page.locator("#connStatus")).toContainText("ไม่อยู่ในรายชื่อที่อนุญาต");
    // ล้าง query ออกจาก URL แล้ว
    expect(page.url()).not.toContain("login=fail");
  });
});
