// @ts-check
const { test, expect } = require("@playwright/test");

const GAMES = `window.GAMES=[
  {id:"a",title:"ท้องถิ่นน่ารู้",description:"เรื่องท้องถิ่นและชุมชน",subject:"สังคมศึกษาฯ",grades:["ป.5"],url:"https://script.google.com/a/exec",tags:["ท้องถิ่น"]},
  {id:"b",title:"เกมคณิตคิดเร็ว",description:"ฝึกบวกลบ",subject:"คณิตศาสตร์",grades:["ป.4"],url:"https://script.google.com/b/exec",tags:["ทบทวนสอบ"]},
  {id:"c",title:"เกมภูมิศาสตร์ไทย",description:"แผนที่ประเทศไทย",subject:"สังคมศึกษาฯ",grades:["ป.4","ป.5"],url:"https://script.google.com/c/exec",tags:["ทบทวนสอบ"]}
];`;

test.describe("E3 — ปรับ UX เล็กๆ", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/announcement.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: "window.ANNOUNCEMENT={enabled:false};" })
    );
    await page.route("**/games.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: GAMES })
    );
  });

  test("ชิปโชว์จำนวนเกมถูกต้องทุกมิติ + aria-label อ่านรู้เรื่อง", async ({ page }) => {
    await page.goto("/index.html");
    // วิชา: สังคมศึกษาฯ 2, คณิตศาสตร์ 1
    await expect(page.locator('#subjectChips .chip[data-value="สังคมศึกษาฯ"] .chip-count')).toHaveText("2");
    await expect(page.locator('#subjectChips .chip[data-value="คณิตศาสตร์"] .chip-count')).toHaveText("1");
    // ระดับชั้น: ป.4 = 2 เกม (b, c), ป.5 = 2 เกม (a, c)
    await expect(page.locator('#gradeChips .chip[data-value="ป.4"] .chip-count')).toHaveText("2");
    await expect(page.locator('#gradeChips .chip[data-value="ป.5"] .chip-count')).toHaveText("2");
    // แท็ก: ทบทวนสอบ 2, ท้องถิ่น 1
    await expect(page.locator('#tagChips .chip[data-value="ทบทวนสอบ"] .chip-count')).toHaveText("2");
    await expect(page.locator('#tagChips .chip[data-value="ท้องถิ่น"] .chip-count')).toHaveText("1");
    // screen reader ได้ประโยคเต็ม ไม่ใช่ "ป.4 2"
    await expect(page.locator('#gradeChips .chip[data-value="ป.4"]')).toHaveAttribute(
      "aria-label", "ป.4 — 2 เกม"
    );
  });

  test("ค้นหาไทยไม่ต้องใส่วรรณยุกต์ให้ตรง", async ({ page }) => {
    await page.goto("/index.html");
    // "ทองถิน" (ไม่มีวรรณยุกต์) ต้องเจอ "ท้องถิ่น"
    await page.fill("#searchInput", "ทองถิน");
    await expect(page.locator(".card-title")).toHaveText(["ท้องถิ่นน่ารู้"]);
    // พิมพ์ถูกทุกตัวก็ยังเจอเหมือนเดิม
    await page.fill("#searchInput", "ท้องถิ่น");
    await expect(page.locator(".card-title")).toHaveText(["ท้องถิ่นน่ารู้"]);
    // ค้นหาในคำอธิบายก็ได้
    await page.fill("#searchInput", "แผนที");
    await expect(page.locator(".card-title")).toHaveText(["เกมภูมิศาสตร์ไทย"]);
  });

  test("ปุ่มแชร์ชุดเกมโผล่เมื่อมีตัวกรอง + คัดลอก URL พร้อมตัวกรอง", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/index.html");
    // ยังไม่กรอง → ไม่โชว์
    await expect(page.locator("#shareSet")).toBeHidden();

    await page.locator('#gradeChips .chip[data-value="ป.4"]').click();
    await expect(page.locator("#shareSet")).toBeVisible();
    await page.locator("#shareSet").click();
    await expect(page.locator("#shareSet")).toHaveText("✅ คัดลอกลิงก์ชุดเกมแล้ว");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("grade=");

    // มุมมองโปรด/เล่นล่าสุด เป็นข้อมูลในเครื่อง แชร์ไม่ได้ → ซ่อน
    await page.locator("#clearFilters").click();
    await page.locator("#viewRecent").click();
    await expect(page.locator("#shareSet")).toBeHidden();
  });

  test("ปุ่มเต็มจอมีในโมดัลและกดได้", async ({ page }) => {
    await page.goto("/index.html");
    await page.locator(".game-card").first().click();
    const fs = page.locator("#fullscreenBtn");
    await expect(fs).toBeVisible();
    await expect(fs).toHaveText("⛶ เต็มจอ");
    await fs.click();
    // chromium ให้ fullscreen ได้จาก user gesture
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(true);
  });
});
