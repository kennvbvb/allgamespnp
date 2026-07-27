// @ts-check
const { test, expect } = require("@playwright/test");

const GAMES = `window.GAMES=[
  {id:"alpha",title:"Alpha เกม",subject:"คณิตศาสตร์",grades:["ป.4"],url:"https://script.google.com/macros/s/A/exec",badge:"แนะนำ",minutes:15,mode:"ทีม",added:"2026-01-01",cover:"https://example.com/cover.jpg"},
  {id:"beta",title:"Beta เกม",subject:"คณิตศาสตร์",grades:["ป.4"],url:"https://script.google.com/macros/s/B/exec",added:"2026-05-01"},
  {id:"gamma",title:"Gamma เกม",subject:"คณิตศาสตร์",grades:["ป.4"],url:"https://script.google.com/macros/s/C/exec",added:"2026-03-01"}
];`;

test.describe("Phase A — metadata + sort", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/announcement.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: "window.ANNOUNCEMENT={enabled:false};" })
    );
    await page.route("**/games.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: GAMES })
    );
  });

  test("การ์ดแสดง badge / เวลาเล่น / โหมด / รูปปก", async ({ page }) => {
    await page.goto("/index.html");
    const alpha = page.locator(".game-card", { hasText: "Alpha เกม" });
    await expect(alpha.locator(".card-badge")).toHaveText("แนะนำ");
    await expect(alpha.locator(".card-meta")).toContainText("15 นาที");
    await expect(alpha.locator(".card-meta")).toContainText("ทีม");
    await expect(alpha.locator(".card-media img")).toHaveAttribute("src", "https://example.com/cover.jpg");
    // Beta ไม่มี cover → ใช้ emoji
    const beta = page.locator(".game-card", { hasText: "Beta เกม" });
    await expect(beta.locator(".card-emoji")).toBeVisible();
    await expect(beta.locator(".card-badge")).toHaveCount(0);
  });

  test("เรียงตามชื่อ / ใหม่ล่าสุด / แนะนำ + จำใน URL", async ({ page }) => {
    await page.goto("/index.html");
    const titles = async () => page.locator(".card-title").allTextContents();

    await page.selectOption("#sortSelect", "name");
    expect(await titles()).toEqual(["Alpha เกม", "Beta เกม", "Gamma เกม"]);
    expect(page.url()).toContain("sort=name");

    await page.selectOption("#sortSelect", "new");
    expect(await titles()).toEqual(["Beta เกม", "Gamma เกม", "Alpha เกม"]); // added ล่าสุดก่อน

    await page.selectOption("#sortSelect", "recommended");
    expect((await titles())[0]).toBe("Alpha เกม"); // badge แนะนำ ขึ้นก่อน

    // reload คงค่า sort
    await page.goto("/index.html?sort=name");
    expect(await page.locator("#sortSelect").inputValue()).toBe("name");
    expect(await titles()).toEqual(["Alpha เกม", "Beta เกม", "Gamma เกม"]);
  });
});
