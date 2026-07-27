// @ts-check
const { test, expect } = require("@playwright/test");

const PREVIEW_GAMES = [
  { id: "pv1", title: "เกมพรีวิว A", subject: "วิทยาศาสตร์", grades: ["ป.5"], url: "https://script.google.com/macros/s/PV/exec", emoji: "🔬", tags: ["ทดลอง"] },
];
const PREVIEW_ANN = { enabled: true, important: false, title: "ประกาศพรีวิว", message: "ข้อความทดสอบพรีวิว" };

test.describe("Phase B — ดูตัวอย่างก่อนเผยแพร่", () => {
  test("index.html?preview=1 อ่านข้อมูลจาก sessionStorage แทนไฟล์", async ({ page }) => {
    // โหลดหน้าปกติก่อน เพื่อตั้ง sessionStorage บน origin เดียวกัน
    await page.route("**/announcement.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: "window.ANNOUNCEMENT={enabled:false};" })
    );
    await page.goto("/index.html");
    await page.evaluate(({ g, a }) => {
      sessionStorage.setItem("gamehub_preview_games", JSON.stringify(g));
      sessionStorage.setItem("gamehub_preview_announcement", JSON.stringify(a));
    }, { g: PREVIEW_GAMES, a: PREVIEW_ANN });

    await page.goto("/index.html?preview=1");
    // แถบพรีวิวขึ้น + การ์ดมาจากข้อมูลพรีวิว (ไม่ใช่ games.js จริง)
    await expect(page.locator(".preview-ribbon")).toBeVisible();
    await expect(page.locator(".card-title")).toHaveText(["เกมพรีวิว A"]);
    // ประกาศพรีวิวแสดง (banner) แม้ไฟล์จริงถูก mock เป็น enabled:false
    await expect(page.locator(".announce-banner")).toContainText("ข้อความทดสอบพรีวิว");
  });

  test("ปุ่มดูตัวอย่างในหน้า admin เปิดแท็บพรีวิวพร้อมข้อมูลปัจจุบัน", async ({ page, context }) => {
    await page.goto("/admin.html");
    // games.js จริงถูก bundle มากับหน้า → กดพรีวิวเลย
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.click("#btnPreview"),
    ]);
    await popup.waitForLoadState("domcontentloaded");
    expect(popup.url()).toContain("preview=1");
    await expect(popup.locator(".preview-ribbon")).toBeVisible();
    await expect(popup.locator(".game-card").first()).toBeVisible();
  });
});
