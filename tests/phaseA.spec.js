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

test.describe('Phase A — sort "ใหม่ล่าสุด" เมื่อข้อมูลไม่มี added', () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/announcement.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: "window.ANNOUNCEMENT={enabled:false};" })
    );
  });

  test("ไม่มี added ทุกเกม → เรียงย้อนลำดับในไฟล์ (ท้ายไฟล์ = ใหม่สุด)", async ({ page }) => {
    await page.route("**/games.js", (r) =>
      r.fulfill({
        contentType: "application/javascript",
        body: `window.GAMES=[
          {id:"one",title:"หนึ่ง",subject:"ส",grades:["ป.4"],url:"https://script.google.com/1/exec"},
          {id:"two",title:"สอง",subject:"ส",grades:["ป.4"],url:"https://script.google.com/2/exec"},
          {id:"three",title:"สาม",subject:"ส",grades:["ป.4"],url:"https://script.google.com/3/exec"}
        ];`,
      })
    );
    await page.goto("/index.html?sort=new");
    expect(await page.locator(".card-title").allTextContents()).toEqual(["สาม", "สอง", "หนึ่ง"]);
  });

  test("ผสมกัน → เกมที่มี added ถือว่าใหม่กว่าเกมที่ไม่มี", async ({ page }) => {
    await page.route("**/games.js", (r) =>
      r.fulfill({
        contentType: "application/javascript",
        body: `window.GAMES=[
          {id:"old1",title:"เก่า 1",subject:"ส",grades:["ป.4"],url:"https://script.google.com/a/exec"},
          {id:"old2",title:"เก่า 2",subject:"ส",grades:["ป.4"],url:"https://script.google.com/b/exec"},
          {id:"new1",title:"ใหม่ มี.ค.",subject:"ส",grades:["ป.4"],url:"https://script.google.com/c/exec",added:"2026-03-01"},
          {id:"new2",title:"ใหม่ ก.ค.",subject:"ส",grades:["ป.4"],url:"https://script.google.com/d/exec",added:"2026-07-01"}
        ];`,
      })
    );
    await page.goto("/index.html?sort=new");
    expect(await page.locator(".card-title").allTextContents()).toEqual([
      "ใหม่ ก.ค.", "ใหม่ มี.ค.", "เก่า 2", "เก่า 1",
    ]);
  });
});
