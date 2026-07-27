// @ts-check
const { test, expect } = require("@playwright/test");

const GAMES = `window.GAMES=[
  {id:"alpha",title:"Alpha เกม",subject:"สังคมศึกษาฯ",grades:["ป.4"],url:"https://script.google.com/macros/s/A/exec",tags:["ประวัติศาสตร์","ทบทวนสอบ"]},
  {id:"beta",title:"Beta เกม",subject:"สังคมศึกษาฯ",grades:["ป.4"],url:"https://script.google.com/macros/s/B/exec",tags:["ทบทวนสอบ"]},
  {id:"gamma",title:"Gamma เกม",subject:"สังคมศึกษาฯ",grades:["ป.4"],url:"https://script.google.com/macros/s/C/exec"}
];`;

const GAMES_NO_TAGS = `window.GAMES=[
  {id:"solo",title:"Solo เกม",subject:"สังคมศึกษาฯ",grades:["ป.4"],url:"https://script.google.com/macros/s/S/exec"}
];`;

test.describe("Phase B — แท็ก/หมวดหมู่", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/announcement.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: "window.ANNOUNCEMENT={enabled:false};" })
    );
  });

  test("ตัวกรองแท็กสร้างจากข้อมูลจริง + กรองการ์ดได้ + จำใน URL", async ({ page }) => {
    await page.route("**/games.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: GAMES })
    );
    await page.goto("/index.html");

    // กลุ่มแท็กแสดง (มีแท็กในข้อมูล) + ชิปเป็น union เรียงแล้ว
    await expect(page.locator("#tagFilterGroup")).toBeVisible();
    const chipTexts = await page.locator("#tagChips .chip").allTextContents();
    expect(chipTexts).toEqual(["ทบทวนสอบ", "ประวัติศาสตร์"]);

    // กดแท็ก "ประวัติศาสตร์" → เหลือ Alpha
    await page.locator("#tagChips .chip", { hasText: "ประวัติศาสตร์" }).click();
    await expect(page.locator(".card-title")).toHaveText(["Alpha เกม"]);
    expect(page.url()).toContain("tag=");

    // reload คงค่า tag
    await page.reload();
    await expect(page.locator("#tagChips .chip.active")).toHaveText("ประวัติศาสตร์");
    await expect(page.locator(".card-title")).toHaveText(["Alpha เกม"]);

    // ล้างตัวกรอง → กลับมาครบ
    await page.locator("#clearFilters").click();
    await expect(page.locator(".card-title")).toHaveCount(3);
  });

  test("กดแท็กซ้ำ = ยกเลิก", async ({ page }) => {
    await page.route("**/games.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: GAMES })
    );
    await page.goto("/index.html");
    const chip = page.locator("#tagChips .chip", { hasText: "ทบทวนสอบ" });
    await chip.click();
    await expect(page.locator(".card-title")).toHaveCount(2); // Alpha + Beta
    await chip.click();
    await expect(page.locator(".card-title")).toHaveCount(3);
  });

  test("โมดัลแสดงแท็กของเกม", async ({ page }) => {
    await page.route("**/games.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: GAMES })
    );
    await page.goto("/index.html");
    await page.locator(".game-card", { hasText: "Alpha เกม" }).click();
    await expect(page.locator("#modalTags .tag-topic")).toHaveText(["#ประวัติศาสตร์", "#ทบทวนสอบ"]);
  });

  test("ไม่มีแท็กในข้อมูล → ซ่อนกลุ่มตัวกรองแท็ก", async ({ page }) => {
    await page.route("**/games.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: GAMES_NO_TAGS })
    );
    await page.goto("/index.html");
    await expect(page.locator("#tagFilterGroup")).toBeHidden();
  });
});
