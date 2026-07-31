// @ts-check
const { test, expect } = require("@playwright/test");

const GAMES = `window.GAMES=[
  {id:"a",title:"ท้องถิ่นน่ารู้",description:"เรื่องท้องถิ่นและชุมชน",subject:"สังคมศึกษาฯ",grades:["ป.5"],url:"https://script.google.com/a/exec",tags:["ท้องถิ่น"]},
  {id:"b",title:"เกมคณิตคิดเร็ว",description:"ฝึกบวกลบ",subject:"คณิตศาสตร์",grades:["ป.4"],url:"https://script.google.com/b/exec"}
];`;

// อ่านขนาดตัวอักษรจริงหลัง CSS คำนวณแล้ว (หน่วย px)
function fontSizeOf(page, selector) {
  return page.locator(selector).first().evaluate(
    (n) => parseFloat(getComputedStyle(n).fontSize)
  );
}

test.describe("H1 — โหมดครูฉายจอ", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/announcement.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: "window.ANNOUNCEMENT={enabled:false};" })
    );
    await page.route("**/games.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: GAMES })
    );
  });

  test("กดปุ่มแล้วตัวอักษรใหญ่ขึ้นจริง + จำไว้ใน URL", async ({ page }) => {
    await page.goto("/index.html");
    const before = await fontSizeOf(page, ".card-title");
    await expect(page.locator("#projectionBtn")).toHaveAttribute("aria-pressed", "false");

    await page.locator("#projectionBtn").click();

    await expect(page.locator("body")).toHaveClass(/is-projection/);
    await expect(page.locator("#projectionBtn")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#projectionBtn")).toHaveText("📺 ออกจากโหมดฉายจอ");
    expect(page.url()).toContain("present=1");

    const after = await fontSizeOf(page, ".card-title");
    expect(after, "ชื่อเกมต้องใหญ่ขึ้นจริง").toBeGreaterThan(before);
    expect(await fontSizeOf(page, ".card-desc")).toBeGreaterThan(14);
  });

  test("รีเฟรชแล้วยังอยู่ในโหมดฉายจอ (bookmark ที่เครื่องฉายได้)", async ({ page }) => {
    await page.goto("/index.html?present=1");
    await expect(page.locator("body")).toHaveClass(/is-projection/);
    await expect(page.locator("#projectionBtn")).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.locator("body")).toHaveClass(/is-projection/);
  });

  test("ซ่อนของที่ไม่ได้ใช้ตอนฉาย แต่ยังกดออกจากโหมดได้", async ({ page }) => {
    await page.goto("/index.html?present=1");
    await expect(page.locator(".site-footer")).toBeHidden();
    await expect(page.locator(".subtitle").first()).toBeHidden();
    // ตัวควบคุมที่ครูต้องใช้ต้องยังอยู่
    await expect(page.locator("#searchInput")).toBeVisible();
    await expect(page.locator("#subjectChips .chip").first()).toBeVisible();
    await expect(page.locator("#projectionBtn")).toBeVisible();

    await page.locator("#projectionBtn").click();
    await expect(page.locator("body")).not.toHaveClass(/is-projection/);
    expect(page.url()).not.toContain("present=1");
    await expect(page.locator(".site-footer")).toBeVisible();
  });

  test("โหมดฉายจอไม่ใช่ตัวกรอง — กด “ล้างตัวกรอง” แล้วต้องไม่หลุด", async ({ page }) => {
    await page.goto("/index.html?present=1");
    await page.locator('#gradeChips .chip[data-value="ป.4"]').click();
    await expect(page.locator(".game-card")).toHaveCount(1);

    await page.locator("#clearFilters").click();
    await expect(page.locator(".game-card")).toHaveCount(2);
    await expect(page.locator("body")).toHaveClass(/is-projection/);
    expect(page.url()).toContain("present=1");
  });

  test("หน้าต่างเกมในโหมดฉายจอไม่เล็กลงกว่าปกติ และเต็มจอเกือบหมด", async ({ page }) => {
    // ใช้ offsetHeight ไม่ใช่ boundingBox — โมดัลมีอนิเมชัน scale(0.96) ตอนเปิด
    // boundingBox จะคืนขนาดหลัง transform ทำให้วัดได้เล็กกว่าจริงถ้าจับตอนอนิเมชันยังไม่จบ
    const panelHeight = () =>
      page.locator(".modal-panel").evaluate((n) => n.offsetHeight);

    await page.goto("/index.html");
    await page.locator(".game-card").first().click();
    const normal = await panelHeight();
    await page.keyboard.press("Escape");

    await page.goto("/index.html?present=1");
    await page.locator(".game-card").first().click();
    const projected = await panelHeight();
    const vh = page.viewportSize().height;

    // บนมือถือโมดัลเต็มจออยู่แล้ว โหมดฉายจอต้องไม่ทำให้เล็กลง
    expect(projected).toBeGreaterThanOrEqual(normal);
    expect(projected / vh, "โมดัลควรกินความสูงจอ ≥90%").toBeGreaterThanOrEqual(0.9);
  });
});
