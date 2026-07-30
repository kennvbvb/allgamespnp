// @ts-check
const { test, expect } = require("@playwright/test");

// นับจำนวนเกมจริงจาก window.GAMES
async function gameCount(page) {
  return page.evaluate(() => (window.GAMES || []).length);
}

test.describe("หน้ารวมเกม (student hub)", () => {
  // ให้เทสต์เป็นอิสระจากเนื้อหาประกาศจริง (ปิดประกาศไว้ก่อน)
  test.beforeEach(async ({ page }) => {
    await page.route("**/announcement.js", (route) =>
      route.fulfill({ contentType: "application/javascript", body: "window.ANNOUNCEMENT={enabled:false};" })
    );
  });

  test("แสดงเกมครบและไม่มี console/CSP error", async ({ page }) => {
    const bad = [];
    page.on("pageerror", (e) => bad.push("pageerror: " + e.message));
    page.on("console", (m) => {
      if (m.type() === "error") bad.push("console: " + m.text());
    });
    await page.goto("/index.html");
    const n = await gameCount(page);
    expect(n).toBeGreaterThan(0);
    await expect(page.locator(".game-card")).toHaveCount(n);
    await expect(page.locator("#resultCount")).toContainText("จาก " + n);
    expect(bad, "ไม่ควรมี error/CSP violation").toEqual([]);
  });

  test("ค้นหาแล้วกรอง + บันทึกคำค้นใน URL", async ({ page }) => {
    await page.goto("/index.html");
    await page.fill("#searchInput", "สิทธิเด็ก");
    await expect(page.locator(".game-card")).toHaveCount(3);
    expect(page.url()).toContain("q=");
    // refresh คงผลลัพธ์
    await page.reload();
    await expect(page.locator(".game-card")).toHaveCount(3);
    await expect(page.locator("#searchInput")).toHaveValue("สิทธิเด็ก");
  });

  test("กรองวิชา+ระดับชั้น และล้างตัวกรอง", async ({ page }) => {
    await page.goto("/index.html");
    const all = await gameCount(page);
    await page.locator("#subjectChips .chip", { hasText: "บูรณาการ" }).click();
    expect(page.url()).toContain("subject=");
    const filtered = await page.locator(".game-card").count();
    expect(filtered).toBeLessThan(all);
    await page.locator("#clearFilters").click();
    await expect(page.locator(".game-card")).toHaveCount(all);
  });

  test("เปิด/ปิดโมดัลด้วยคลิก, Escape และปุ่ม Back", async ({ page }) => {
    await page.goto("/index.html");
    await page.locator(".game-card").first().click();
    await expect(page.locator("#gameModal")).toBeVisible();
    // focus อยู่ที่ปุ่มปิด
    expect(await page.evaluate(() => document.activeElement?.matches(".modal-panel .icon-btn"))).toBeTruthy();
    // Escape ปิด
    await page.keyboard.press("Escape");
    await expect(page.locator("#gameModal")).toBeHidden();
    // เปิดใหม่แล้วกด Back ปิด (ไม่หลุดออกจากเว็บ)
    // โหลดหน้าใหม่ก่อน เพื่อให้ history เริ่มสะอาด — การปิดด้วย Escape ข้างบนใช้
    // history.back() แบบ async ถ้าเปิด/ปิดซ้อนกันเร็วๆ ลำดับ history จะสลับกันได้
    await page.goto("/index.html");
    await page.locator(".game-card").first().click();
    await expect(page.locator("#gameModal")).toBeVisible();
    // ใช้ history.back() ในหน้าเลย ไม่ใช้ page.goBack() เพราะการย้อนข้ามการเปลี่ยน
    // แค่ hash ไม่เกิด event "load" ที่ page.goBack() รออยู่ → timeout สุ่มๆ
    await page.evaluate(() => history.back());
    await expect(page.locator("#gameModal")).toBeHidden();
    expect(page.url()).toContain("/index.html");
  });

  test("deep link #game=<id> เปิดเกมที่ถูกต้อง และปุ่มคัดลอกเป็นลิงก์แชร์", async ({ page }) => {
    await page.goto("/index.html");
    const first = await page.evaluate(() => window.GAMES[0]);
    await page.goto("/index.html#game=" + encodeURIComponent(first.id));
    await expect(page.locator("#gameModal")).toBeVisible();
    await expect(page.locator("#modalTitle")).toHaveText(first.title);
    const shareUrl = await page.locator("#copyLink").getAttribute("data-url");
    expect(shareUrl).toContain("#game=" + first.id);
  });

  test("deep link เลขเดิม (#game=0) ยังเปิดได้ (backward compat)", async ({ page }) => {
    await page.goto("/index.html#game=0");
    await expect(page.locator("#gameModal")).toBeVisible();
  });

  test("บั๊ก dialog stack: deep link + ประกาศสำคัญ ปิดประกาศแล้วโมดัลเกมยังเปิด", async ({ page }) => {
    // ทับ route ของ beforeEach ด้วยประกาศสำคัญ (handler ล่าสุดถูกเรียกก่อน)
    await page.route("**/announcement.js", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: 'window.ANNOUNCEMENT={enabled:true,important:true,title:"สำคัญ",message:"ทดสอบ"};',
      })
    );
    await page.goto("/index.html");
    const id = await page.evaluate(() => window.GAMES[4].id);
    await page.goto("about:blank"); // บังคับให้ goto ถัดไปโหลดหน้าใหม่ (ไม่ใช่แค่เปลี่ยน hash)
    await page.goto("/index.html#game=" + encodeURIComponent(id));
    await expect(page.locator("#gameModal")).toBeVisible();
    await expect(page.locator(".announce-overlay")).toHaveCount(1);
    await page.locator(".announce-ok").click();
    // โมดัลเกมยังเปิด + พื้นหลังยังล็อก + focus อยู่ในโมดัล
    await expect(page.locator("#gameModal")).toBeVisible();
    expect(await page.evaluate(() => document.body.classList.contains("modal-open"))).toBeTruthy();
    expect(await page.evaluate(() => document.querySelector(".container").hasAttribute("inert"))).toBeTruthy();
    expect(await page.evaluate(() => document.getElementById("gameModal").contains(document.activeElement))).toBeTruthy();
  });
});
