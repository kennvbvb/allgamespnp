// @ts-check
const { test, expect } = require("@playwright/test");

test.describe("หน้าจัดการเกม (admin)", () => {
  test("โหลดได้: ตั้งค่าขั้นสูงพับ, จำ token ปิด, ไม่มี error/CSP", async ({ page }) => {
    const bad = [];
    page.on("pageerror", (e) => bad.push("pageerror: " + e.message));
    page.on("console", (m) => { if (m.type() === "error") bad.push("console: " + m.text()); });
    await page.goto("/admin.html");
    await expect(page.locator("#cfgOwner")).toBeHidden(); // อยู่ใน <details> ที่ยังไม่เปิด
    expect(await page.locator("#cfgRemember").isChecked()).toBeFalsy();
    await expect(page.locator("#tokenStored")).toContainText("ไม่ได้ถูกเก็บ");
    expect(bad).toEqual([]);
  });

  test("validation ใต้ช่อง + focus ช่องแรกที่ผิด (ไม่ใช้ alert)", async ({ page }) => {
    let dialog = false;
    page.on("dialog", (d) => { dialog = true; d.dismiss(); });
    await page.goto("/admin.html");
    await page.click("#btnSaveGame");
    await expect(page.locator("#formErrors")).toBeVisible();
    await expect(page.locator("#errTitle")).toBeVisible();
    await expect(page.locator("#errGrades")).toBeVisible();
    expect(dialog).toBeFalsy();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("fTitle");
  });

  test("เพิ่มเกม → รายการเพิ่มขึ้น + สรุปการเปลี่ยนแปลง", async ({ page }) => {
    await page.goto("/admin.html");
    const before = await page.locator(".admin-list-item").count();
    await page.fill("#fTitle", "เกมทดสอบ CI");
    await page.fill("#fSubject", "คณิตศาสตร์");
    await page.fill("#fUrl", "https://script.google.com/macros/s/CI/exec");
    await page.locator('.grade-picker input[value="ป.4"]').check();
    await page.click("#btnSaveGame");
    await expect(page.locator(".admin-list-item")).toHaveCount(before + 1);
    await expect(page.locator("#changeSummary")).toContainText("เพิ่ม 1");
  });

  test("ค้นหาในรายการ + ปิดปุ่มเลื่อนตอนกรอง", async ({ page }) => {
    await page.goto("/admin.html");
    await page.fill("#listSearch", "ธรรม");
    const shown = await page.locator(".admin-list-item").count();
    expect(shown).toBeGreaterThan(0);
    expect(await page.locator('.admin-list-item [data-act="up"]').first().isDisabled()).toBeTruthy();
    await page.fill("#listSearch", "ไม่มีเกมนี้แน่นอน");
    await expect(page.locator("#listEmpty")).toBeVisible();
  });

  test("ลบ → snackbar เลิกทำ → กู้คืนได้ (ไม่ใช้ confirm)", async ({ page }) => {
    let dialog = false;
    page.on("dialog", (d) => { dialog = true; d.dismiss(); });
    await page.goto("/admin.html");
    const before = await page.locator(".admin-list-item").count();
    await page.locator('.admin-list-item [data-act="del"]').first().click();
    await expect(page.locator("#snackbar")).toBeVisible();
    await expect(page.locator(".admin-list-item")).toHaveCount(before - 1);
    expect(dialog).toBeFalsy();
    await page.click("#snackbarAction");
    await expect(page.locator(".admin-list-item")).toHaveCount(before);
  });

  test("token เก็บใน sessionStorage ไม่ใช่ localStorage", async ({ page }) => {
    await page.goto("/admin.html");
    await page.check("#cfgRemember");
    await page.fill("#cfgToken", "github_pat_ci_test");
    await page.click("#btnTest"); // saveCfg ทำงานก่อน network
    const s = await page.evaluate(() => ({
      ss: sessionStorage.getItem("gamehub_gh_token"),
      ls: localStorage.getItem("gamehub_gh_token"),
    }));
    expect(s.ss).toBe("github_pat_ci_test");
    expect(s.ls).toBeNull();
  });

  test("JSON import ที่ผิด schema ถูกปฏิเสธพร้อมแจ้ง error", async ({ page }) => {
    let msg = "";
    page.on("dialog", (d) => { msg = d.message(); d.dismiss(); });
    await page.goto("/admin.html");
    await page.evaluate(() => { document.querySelector("details.backup").open = true; });
    await page.fill(
      "#importBox",
      JSON.stringify([{ title: "x", subject: "s", grades: ["ป.4"], url: "javascript:alert(1)" }])
    );
    await page.click("#btnImport");
    expect(msg).toContain("https");
  });
});
