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
    // hover จะเลื่อนรายการเข้าจอให้เอง แล้วค่อยอ่านพิกัดจริง (page.mouse ใช้พิกัด viewport)
    // hover จะเลื่อนรายการเข้าจอให้เอง แล้วค่อยอ่านพิกัดจริง (page.mouse ใช้พิกัด viewport)
    await handleA.hover();
    const hb = await handleA.boundingBox();
    const items = page.locator(".admin-list-item");
    const box1 = await items.nth(1).boundingBox();
    const box2 = await items.nth(2).boundingBox();

    await page.mouse.down();
    // ลากผ่าน "จุดกึ่งกลาง" ของรายการถัดไปทีละอัน — DOM สลับตำแหน่งสดๆ ระหว่างลาก
    // ต้องเล็งจุดกึ่งกลางจริงของแต่ละรายการ (คำนวณจากระยะก้าวจะพลาดเพราะมี gap)
    for (const box of [box1, box2]) {
      await page.mouse.move(hb.x + hb.width / 2, box.y + box.height / 2 + 2, { steps: 8 });
    }
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
