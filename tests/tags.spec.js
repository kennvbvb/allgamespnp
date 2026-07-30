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

    // กลุ่มแท็กแสดง (มีแท็กในข้อมูล) + ชิปเป็น union เรียงตามจำนวนเกม
    await expect(page.locator("#tagFilterGroup")).toBeVisible();
    const chipValues = await page.locator("#tagChips .chip").evaluateAll((els) =>
      els.map((e) => e.dataset.value)
    );
    expect(chipValues).toEqual(["ทบทวนสอบ", "ประวัติศาสตร์"]);
    // ชิปโชว์จำนวนเกมต่อแท็ก (ทบทวนสอบ 2 เกม)
    await expect(page.locator('#tagChips .chip[data-value="ทบทวนสอบ"] .chip-count')).toHaveText("2");

    // กดแท็ก "ประวัติศาสตร์" → เหลือ Alpha
    await page.locator("#tagChips .chip", { hasText: "ประวัติศาสตร์" }).click();
    await expect(page.locator(".card-title")).toHaveText(["Alpha เกม"]);
    expect(page.url()).toContain("tag=");

    // reload คงค่า tag
    await page.reload();
    await expect(page.locator("#tagChips .chip.active")).toHaveAttribute("data-value", "ประวัติศาสตร์");
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

  test("ชิปแท็กเรียงตามจำนวนเกมมาก→น้อย", async ({ page }) => {
    await page.route("**/games.js", (r) =>
      r.fulfill({
        contentType: "application/javascript",
        body: `window.GAMES=[
          {id:"a",title:"A",subject:"ส",grades:["ป.4"],url:"https://script.google.com/a/exec",tags:["น้อย"]},
          {id:"b",title:"B",subject:"ส",grades:["ป.4"],url:"https://script.google.com/b/exec",tags:["เยอะ"]},
          {id:"c",title:"C",subject:"ส",grades:["ป.4"],url:"https://script.google.com/c/exec",tags:["เยอะ"]},
          {id:"d",title:"D",subject:"ส",grades:["ป.4"],url:"https://script.google.com/d/exec",tags:["เยอะ","กลาง"]},
          {id:"e",title:"E",subject:"ส",grades:["ป.4"],url:"https://script.google.com/e/exec",tags:["กลาง"]}
        ];`,
      })
    );
    await page.goto("/index.html");
    // เยอะ=3, กลาง=2, น้อย=1
    const values = await page.locator("#tagChips .chip").evaluateAll((els) => els.map((e) => e.dataset.value));
    expect(values).toEqual(["เยอะ", "กลาง", "น้อย"]);
    const counts = await page.locator("#tagChips .chip-count").allTextContents();
    expect(counts).toEqual(["3", "2", "1"]);
  });

  test("แท็กเกิน 6 อัน → ย่อไว้ กดขยายได้ + ถ้าแท็กที่เลือกถูกซ่อนจะกางให้เอง", async ({ page }) => {
    const many = Array.from({ length: 9 }, (_, i) =>
      `{id:"g${i}",title:"เกม ${i}",subject:"ส",grades:["ป.4"],url:"https://script.google.com/${i}/exec",tags:["t${i}"]}`
    ).join(",");
    await page.route("**/games.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: `window.GAMES=[${many}];` })
    );

    await page.goto("/index.html");
    const tagChips = page.locator("#tagChips .chip:not(.chip-more)");
    await expect(tagChips).toHaveCount(9);
    // ย่อไว้: เห็นแค่ 6 อันแรก
    await expect(page.locator("#tagChips .chip:not(.chip-more):visible")).toHaveCount(6);
    const more = page.locator(".chip-more");
    await expect(more).toHaveText("+ อีก 3 แท็ก");
    await expect(more).toHaveAttribute("aria-expanded", "false");

    await more.click();
    await expect(page.locator("#tagChips .chip:not(.chip-more):visible")).toHaveCount(9);
    await expect(more).toHaveAttribute("aria-expanded", "true");

    // เข้าด้วย URL ที่เลือกแท็กซึ่งอยู่ในส่วนที่ถูกซ่อน → ต้องกางให้เห็นเลย
    await page.goto("/index.html?tag=t8");
    await expect(page.locator("#tagChips .chip:not(.chip-more):visible")).toHaveCount(9);
    await expect(page.locator("#tagChips .chip.active")).toHaveAttribute("data-value", "t8");
  });

  test("ไม่มีแท็กในข้อมูล → ซ่อนกลุ่มตัวกรองแท็ก", async ({ page }) => {
    await page.route("**/games.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: GAMES_NO_TAGS })
    );
    await page.goto("/index.html");
    await expect(page.locator("#tagFilterGroup")).toBeHidden();
  });
});
