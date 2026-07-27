// @ts-check
const { test, expect } = require("@playwright/test");

const GAMES = `window.GAMES=[
  {id:"a",title:"เกม A",subject:"คณิตศาสตร์",grades:["ป.4"],url:"https://script.google.com/macros/s/A/exec"},
  {id:"b",title:"เกม B",subject:"คณิตศาสตร์",grades:["ป.4"],url:"https://script.google.com/macros/s/B/exec"},
  {id:"c",title:"เกม C",subject:"คณิตศาสตร์",grades:["ป.4"],url:"https://script.google.com/macros/s/C/exec"}
];`;

test.describe("Phase B — ลากจัดลำดับในหน้า admin", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/games.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: GAMES })
    );
    await page.route("**/announcement.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: "window.ANNOUNCEMENT={enabled:false};" })
    );
    await page.goto("/admin.html");
  });

  test("ลากเกม A ลงล่างสุด → ลำดับเปลี่ยน + ขึ้นแถบยังไม่เผยแพร่", async ({ page }) => {
    const titles = () => page.locator(".li-title").allTextContents();
    expect(await titles()).toEqual(["เกม A", "เกม B", "เกม C"]);

    const handleA = page.locator(".admin-list-item", { hasText: "เกม A" }).locator(".drag-handle");
    const itemC = page.locator(".admin-list-item", { hasText: "เกม C" });
    // page.mouse ใช้พิกัด viewport — ต้องเลื่อนรายการเข้ามาในจอก่อนแล้วค่อยอ่านพิกัด
    await itemC.scrollIntoViewIfNeeded();
    const cb = await itemC.boundingBox();
    await handleA.hover();
    await page.mouse.down();
    // ลากลงไปถึงครึ่งล่างของ C เพื่อให้ A ไปอยู่ท้ายสุด
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height - 2, { steps: 10 });
    await page.mouse.up();

    expect(await titles()).toEqual(["เกม B", "เกม C", "เกม A"]);
    await expect(page.locator("#publishBar")).toBeVisible();
    await expect(page.locator("#changeSummary")).toContainText("จัดลำดับใหม่");
  });

  test("ปิดลากเมื่อกำลังกรองรายการ", async ({ page }) => {
    await page.fill("#listSearch", "เกม B");
    await expect(page.locator(".admin-list-item")).toHaveCount(1);
    await expect(page.locator(".admin-list-item .drag-handle")).toBeDisabled();
  });
});
