// @ts-check
const { test, expect } = require("@playwright/test");

const GAMES = `window.GAMES=[
  {id:"a",title:"เกม A",subject:"คณิต",grades:["ป.4"],url:"https://script.google.com/macros/s/A/exec"},
  {id:"b",title:"เกม B",subject:"คณิต",grades:["ป.4"],url:"https://script.google.com/macros/s/B/exec"},
  {id:"c",title:"เกม C",subject:"คณิต",grades:["ป.4"],url:"https://script.google.com/macros/s/C/exec"}
];`;

test.describe("Phase A — favorites + recently played", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/announcement.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: "window.ANNOUNCEMENT={enabled:false};" })
    );
    await page.route("**/games.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: GAMES })
    );
  });

  test("เพิ่มโปรดในโมดัล → กรอง 'เฉพาะโปรด' เหลือเฉพาะที่กด + เก็บใน localStorage", async ({ page }) => {
    await page.goto("/index.html");
    // เปิดเกม B แล้วกดเพิ่มโปรด
    await page.locator(".game-card", { hasText: "เกม B" }).click();
    await expect(page.locator("#favToggle")).toContainText("เพิ่มในโปรด");
    await page.click("#favToggle");
    await expect(page.locator("#favToggle")).toContainText("อยู่ในโปรด");
    const favs = await page.evaluate(() => JSON.parse(localStorage.getItem("gamehub_favorites") || "[]"));
    expect(favs).toContain("b");
    await page.keyboard.press("Escape");
    // กรองเฉพาะโปรด
    await page.click("#viewFav");
    await expect(page.locator(".game-card")).toHaveCount(1);
    await expect(page.locator(".card-title")).toHaveText("เกม B");
    expect(page.url()).toContain("view=fav");
  });

  test("เล่นล่าสุดเรียงตามที่เพิ่งเปิด (ล่าสุดก่อน)", async ({ page }) => {
    await page.goto("/index.html");
    for (const t of ["เกม A", "เกม C"]) {
      await page.locator(".game-card", { hasText: t }).click();
      await expect(page.locator("#gameModal")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator("#gameModal")).toBeHidden();
    }
    await page.click("#viewRecent");
    // เปิด C หลังสุด → มาก่อน A
    expect(await page.locator(".card-title").allTextContents()).toEqual(["เกม C", "เกม A"]);
  });

  test("โปรดว่าง → ขึ้นข้อความชวนกด", async ({ page }) => {
    await page.goto("/index.html");
    await page.click("#viewFav");
    await expect(page.locator("#gameGrid .game-card")).toHaveCount(0);
    await expect(page.locator("#emptyState")).toBeVisible();
    await expect(page.locator("#emptyState")).toContainText("ยังไม่มีเกมโปรด");
  });
});
