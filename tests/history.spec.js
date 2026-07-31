// @ts-check
const { test, expect } = require("@playwright/test");

const GAMES = `window.GAMES=[
  {id:"a",title:"เกม A",subject:"สังคมศึกษาฯ",grades:["ป.4"],url:"https://script.google.com/a/exec"},
  {id:"b",title:"เกม B",subject:"สังคมศึกษาฯ",grades:["ป.5"],url:"https://script.google.com/b/exec"}
];`;

// เนื้อไฟล์ games.js แบบที่หน้า admin เขียนจริง (parseGamesFromText ต้องแกะได้)
function gamesJs(list) {
  return "const GAMES = " + JSON.stringify(list, null, 2) + ";\n\nwindow.GAMES = GAMES;\n";
}

const HEAD_GAMES = [
  { id: "a", title: "เกม A", description: "", subject: "สังคมศึกษาฯ", grades: ["ป.4"], url: "https://script.google.com/a/exec" },
  { id: "b", title: "เกม B", description: "", subject: "สังคมศึกษาฯ", grades: ["ป.5"], url: "https://script.google.com/b/exec" },
];
const OLD_GAMES = [
  { id: "z", title: "เกมเวอร์ชันเก่า", description: "", subject: "สังคมศึกษาฯ", grades: ["ป.6"], url: "https://script.google.com/z/exec" },
];

const COMMITS = [
  { sha: "headsha", commit: { author: { date: "2026-07-30T09:15:00Z" }, message: "อัปเดตรายการเกมผ่านหน้า admin (2 เกม)" }, author: { login: "kennvbvb" } },
  { sha: "oldsha", commit: { author: { date: "2026-07-20T03:00:00Z" }, message: "อัปเดตรายการเกมผ่านหน้า admin (1 เกม)" }, author: { login: "kennvbvb" } },
];

/** ตอบ API ของ GitHub แบบ PAT (โหมดเริ่มต้นของหน้า admin) */
async function stubGitHub(page, opts = {}) {
  await page.route("**/games.js", (r) =>
    r.fulfill({ contentType: "application/javascript", body: GAMES })
  );
  await page.route("**/announcement.js", (r) =>
    r.fulfill({ contentType: "application/javascript", body: "window.ANNOUNCEMENT={enabled:false};" })
  );
  await page.route("https://api.github.com/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes("/commits?")) {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(COMMITS) });
    }
    if (url.includes("/contents/games.js") && method === "GET") {
      const isOld = url.includes("ref=oldsha");
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          sha: isOld ? "oldsha" : "headsha",
          content: Buffer.from(gamesJs(isOld ? OLD_GAMES : HEAD_GAMES), "utf8").toString("base64"),
        }),
      });
    }
    if (url.includes("/contents/games.js") && method === "PUT") {
      if (opts.onPut) opts.onPut(JSON.parse(route.request().postData() || "{}"));
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ content: { sha: "newsha" }, commit: { html_url: "https://github.com/x" } }),
      });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
}

/** ตั้งค่า repo + token ให้หน้า admin พร้อมคุยกับ GitHub */
async function openAdminWithToken(page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "gamehub_gh_cfg",
      JSON.stringify({ owner: "kennvbvb", repo: "allgamespnp", branch: "main", path: "games.js", worker: "" })
    );
    sessionStorage.setItem("gamehub_gh_token", "ghp_TESTTOKEN");
  });
  await page.goto("/admin.html");
}

test.describe("H2 — ประวัติการแก้ไข + กู้คืน", () => {
  test("กางกล่องประวัติแล้วโหลดรายการ commit ให้เอง", async ({ page }) => {
    await stubGitHub(page);
    await openAdminWithToken(page);

    // ยังไม่กาง = ยังไม่โหลด
    await expect(page.locator("#historyList .history-item")).toHaveCount(0);

    await page.locator("#historyBox summary").click();
    await expect(page.locator("#historyList .history-item")).toHaveCount(2);
    await expect(page.locator("#historyStatus")).toContainText("แสดง 2 รายการล่าสุด");
    // วันที่เป็นภาษาไทย + บอกคนแก้
    await expect(page.locator(".history-item").first()).toContainText("2569");
    await expect(page.locator(".history-item").first()).toContainText("โดย kennvbvb");
    // แถวบนสุด = เวอร์ชันบนเว็บตอนนี้ → ไม่ให้กู้คืนทับตัวเอง
    await expect(page.locator(".history-item").first()).toContainText("เวอร์ชันปัจจุบัน");
    await expect(page.locator('.history-item').first().locator('[data-hact="restore"]')).toHaveCount(0);
    await expect(page.locator('.history-item').nth(1).locator('[data-hact="restore"]')).toHaveCount(1);
  });

  test("กู้คืนเวอร์ชันเก่า → รายการเปลี่ยน + ขึ้นเป็นงานที่ยังไม่บันทึก", async ({ page }) => {
    await stubGitHub(page);
    await openAdminWithToken(page);
    page.on("dialog", (d) => d.accept());

    await page.locator("#historyBox summary").click();
    await expect(page.locator("#historyList .history-item")).toHaveCount(2);
    await page.locator('.history-item').nth(1).locator('[data-hact="restore"]').click();

    await expect(page.locator(".li-title")).toHaveText(["เกมเวอร์ชันเก่า"]);
    await expect(page.locator("#historyStatus")).toContainText("กู้คืนเป็นเวอร์ชัน");
    // ยังไม่ขึ้นเว็บ — ต้องขึ้นสถานะงานค้างให้ครูเห็น
    await expect(page.locator("#dirtyBadge")).toBeVisible();
  });

  test("บันทึกหลังกู้คืน → ต้องใช้ sha ของเวอร์ชันล่าสุด ไม่ใช่ sha ของ commit เก่า", async ({ page }) => {
    let put = null;
    await stubGitHub(page, { onPut: (b) => { put = b; } });
    await openAdminWithToken(page);
    page.on("dialog", (d) => d.accept());

    // โหลดข้อมูลล่าสุดจาก GitHub ก่อน (ตั้ง base sha = headsha)
    await page.locator("#btnReload").click();
    await expect(page.locator("#commitStatus")).toContainText("โหลดข้อมูลล่าสุด");

    await page.locator("#historyBox summary").click();
    await page.locator('.history-item').nth(1).locator('[data-hact="restore"]').click();
    await expect(page.locator(".li-title")).toHaveText(["เกมเวอร์ชันเก่า"]);

    await page.locator("#btnCommit").click();
    await expect(page.locator("#commitStatus")).toContainText("บันทึกสำเร็จ");

    // เขียนทับ HEAD ด้วยเนื้อหาเก่า = commit ใหม่ปกติ ไม่ใช่การย้อน sha
    expect(put.sha, "ต้องส่ง sha ของ HEAD ไม่ใช่ oldsha").toBe("headsha");
    expect(put.branch).toBe("main");
    expect(Buffer.from(put.content, "base64").toString("utf8")).toContain("เกมเวอร์ชันเก่า");
  });

  test("ดูตัวอย่างเวอร์ชันเก่าได้โดยไม่แตะรายการปัจจุบัน", async ({ page, context }) => {
    await stubGitHub(page);
    await openAdminWithToken(page);

    await page.locator("#historyBox summary").click();
    const popupPromise = context.waitForEvent("page");
    await page.locator('.history-item').nth(1).locator('[data-hact="preview"]').click();
    const popup = await popupPromise;
    expect(popup.url()).toContain("preview=1");
    await popup.close();

    await expect(page.locator("#historyStatus")).toContainText("เปิดตัวอย่างในแท็บใหม่แล้ว");
    // รายการที่กำลังแก้ต้องไม่เปลี่ยน
    await expect(page.locator(".li-title")).toHaveText(["เกม A", "เกม B"]);
    await expect(page.locator("#dirtyBadge")).toBeHidden();
  });

  test("ยังไม่ได้ใส่ token → บอกให้ตั้งค่าก่อน ไม่เงียบ", async ({ page }) => {
    await stubGitHub(page);
    await page.goto("/admin.html");
    await page.locator("#historyBox summary").click();
    await expect(page.locator("#historyStatus")).toContainText("token");
  });

  test("โหมดล็อกอิน (worker) → ดึงประวัติผ่าน worker ไม่แตะ api.github.com", async ({ page }) => {
    const WORKER = "https://fake-worker.workers.dev";
    let hitGitHub = false;
    await page.route("**/games.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: GAMES })
    );
    await page.route("**/announcement.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: "window.ANNOUNCEMENT={enabled:false};" })
    );
    await page.route("https://api.github.com/**", (r) => {
      hitGitHub = true;
      return r.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    });
    await page.route(WORKER + "/api/me", (r) =>
      r.fulfill({ contentType: "application/json", body: '{"login":"kennvbvb"}' })
    );
    await page.route(WORKER + "/api/file**", (r) =>
      r.fulfill({ contentType: "application/json", body: JSON.stringify({ sha: "headsha", text: gamesJs(HEAD_GAMES) }) })
    );
    await page.route(WORKER + "/api/history**", (r) =>
      r.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          commits: [
            { sha: "headsha", date: "2026-07-30T09:15:00Z", login: "kennvbvb", message: "ล่าสุด" },
            { sha: "oldsha", date: "2026-07-20T03:00:00Z", login: "kennvbvb", message: "เก่ากว่า" },
          ],
        }),
      })
    );

    await page.addInitScript((w) => {
      localStorage.setItem("gamehub_gh_cfg", JSON.stringify({ owner: "kennvbvb", repo: "allgamespnp", branch: "main", path: "games.js", worker: w }));
    }, WORKER);
    await page.goto("/admin.html");
    await page.locator("#historyBox summary").click();

    await expect(page.locator("#historyList .history-item")).toHaveCount(2);
    await expect(page.locator(".history-item").nth(1)).toContainText("เก่ากว่า");
    expect(hitGitHub, "โหมด worker ต้องไม่ยิง GitHub จากเบราว์เซอร์").toBe(false);
    expect(await page.evaluate(() => sessionStorage.getItem("gamehub_gh_token"))).toBeNull();
  });
});

test.describe("H2 — กู้คืนจากไฟล์สำรอง", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/games.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: GAMES })
    );
    await page.route("**/announcement.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: "window.ANNOUNCEMENT={enabled:false};" })
    );
  });

  test("เลือกไฟล์ JSON แล้วรายการเปลี่ยนตามไฟล์", async ({ page }) => {
    await page.goto("/admin.html");
    page.on("dialog", (d) => d.accept());

    await page.locator("details.backup summary").click();
    await page.locator("#importFile").setInputFiles({
      name: "games-backup-2026-07-20.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(OLD_GAMES), "utf8"),
    });

    await expect(page.locator(".li-title")).toHaveText(["เกมเวอร์ชันเก่า"]);
    await expect(page.locator("#commitStatus")).toContainText("นำเข้าแล้ว (1 เกม)");
    await expect(page.locator("#dirtyBadge")).toBeVisible();
  });

  test("ไฟล์เสีย → แจ้งเตือนและไม่ทับข้อมูลเดิม", async ({ page }) => {
    await page.goto("/admin.html");
    await page.locator("details.backup summary").click();
    await page.locator("#importFile").setInputFiles({
      name: "พัง.json",
      mimeType: "application/json",
      buffer: Buffer.from("{ไม่ใช่ JSON", "utf8"),
    });

    await expect(page.locator("#commitStatus")).toContainText("JSON ไม่ถูกต้อง");
    await expect(page.locator(".li-title")).toHaveText(["เกม A", "เกม B"]);
    await expect(page.locator("#dirtyBadge")).toBeHidden();
  });

  test("ไฟล์ที่ข้อมูลไม่ผ่านการตรวจ (ลิงก์ไม่ใช่ https) → ไม่นำเข้า", async ({ page }) => {
    await page.goto("/admin.html");
    const messages = [];
    page.on("dialog", (d) => { messages.push(d.message()); d.accept(); });

    await page.locator("details.backup summary").click();
    await page.locator("#importFile").setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify([
        { id: "x", title: "เกมลิงก์ไม่ปลอดภัย", subject: "ส", grades: ["ป.4"], url: "http://example.com/x" },
      ]), "utf8"),
    });

    await expect(page.locator("#commitStatus")).toContainText("นำเข้าไม่ได้");
    await expect(page.locator(".li-title")).toHaveText(["เกม A", "เกม B"]);
    expect(messages.join("\n")).toContain("https");
  });
});
