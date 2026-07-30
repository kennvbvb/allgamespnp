// @ts-check
const { test, expect } = require("@playwright/test");

const GAMES = `window.GAMES=[
  {id:"a",title:"เกม A",subject:"สังคมศึกษาฯ",grades:["ป.4"],url:"https://script.google.com/a/exec"},
  {id:"b",title:"เกม B",subject:"สังคมศึกษาฯ",grades:["ป.5"],url:"https://script.google.com/b/exec",tags:["เก่า"]},
  {id:"c",title:"เกม C",subject:"คณิตศาสตร์",grades:["ป.5"],url:"https://script.google.com/c/exec"}
];`;

async function openAdmin(page) {
  await page.route("**/games.js", (r) =>
    r.fulfill({ contentType: "application/javascript", body: GAMES })
  );
  await page.route("**/announcement.js", (r) =>
    r.fulfill({ contentType: "application/javascript", body: "window.ANNOUNCEMENT={enabled:false};" })
  );
  await page.goto("/admin.html");
}

/** ติ๊กเลือกเกมตามชื่อ */
function itemCheckbox(page, title) {
  return page.locator(".admin-list-item", { hasText: title }).locator('input[data-act="select"]');
}

test.describe("E2 — จัดการหลายเกมพร้อมกัน", () => {
  test("แถบ bulk โผล่เมื่อเลือก + นับจำนวนถูก", async ({ page }) => {
    await openAdmin(page);
    await expect(page.locator("#bulkBar")).toBeHidden();

    await itemCheckbox(page, "เกม A").check();
    await expect(page.locator("#bulkBar")).toBeVisible();
    await expect(page.locator("#bulkCount")).toHaveText("เลือกไว้ 1 เกม");

    await itemCheckbox(page, "เกม C").check();
    await expect(page.locator("#bulkCount")).toHaveText("เลือกไว้ 2 เกม");

    await page.locator("#bulkClear").click();
    await expect(page.locator("#bulkBar")).toBeHidden();
  });

  test("ติดแท็กหลายเกมพร้อมกัน (ไม่ทับแท็กเดิม) แล้วถอดออกได้", async ({ page }) => {
    await openAdmin(page);
    await itemCheckbox(page, "เกม A").check();
    await itemCheckbox(page, "เกม B").check();

    await page.fill("#bulkTagInput", "ทบทวนสอบ, ป.ปลาย");
    await page.locator("#bulkTagAdd").click();
    await expect(page.locator("#publishBar")).toBeVisible();

    // ตรวจข้อมูลจริงผ่านพรีวิว (sessionStorage) — B ต้องยังมีแท็กเดิม "เก่า" อยู่
    const tags = await page.evaluate(() => {
      document.getElementById("btnPreview").click();
      return JSON.parse(sessionStorage.getItem("gamehub_preview_games"))
        .map((g) => [g.id, (g.tags || []).join("|")]);
    });
    expect(tags).toEqual([
      ["a", "ทบทวนสอบ|ป.ปลาย"],
      ["b", "เก่า|ทบทวนสอบ|ป.ปลาย"],
      ["c", ""],
    ]);

    // ถอดแท็กออกจากที่เลือก
    await page.fill("#bulkTagInput", "ทบทวนสอบ");
    await page.locator("#bulkTagRemove").click();
    const after = await page.evaluate(() => {
      document.getElementById("btnPreview").click();
      return JSON.parse(sessionStorage.getItem("gamehub_preview_games"))
        .map((g) => [g.id, (g.tags || []).join("|")]);
    });
    expect(after).toEqual([["a", "ป.ปลาย"], ["b", "เก่า|ป.ปลาย"], ["c", ""]]);
  });

  test("ตั้งวิชา/โหมด/นาที/ป้าย ทีเดียวหลายเกม", async ({ page }) => {
    await openAdmin(page);
    await itemCheckbox(page, "เกม A").check();
    await itemCheckbox(page, "เกม C").check();

    await page.fill("#bulkSubject", "บูรณาการ");
    await page.selectOption("#bulkMode", "ทีม");
    await page.fill("#bulkMinutes", "20");
    await page.selectOption("#bulkBadge", "แนะนำ");
    await page.locator("#bulkApply").click();

    const data = await page.evaluate(() => {
      document.getElementById("btnPreview").click();
      return JSON.parse(sessionStorage.getItem("gamehub_preview_games"))
        .map((g) => [g.id, g.subject, g.mode || "", g.minutes || 0, g.badge || ""]);
    });
    expect(data).toEqual([
      ["a", "บูรณาการ", "ทีม", 20, "แนะนำ"],
      ["b", "สังคมศึกษาฯ", "", 0, ""], // ไม่ได้เลือก ต้องไม่โดนแก้
      ["c", "บูรณาการ", "ทีม", 20, "แนะนำ"],
    ]);
    // เคลียร์ค่าในแถบหลังใช้ กันเผลอกดซ้ำกับชุดอื่น
    await expect(page.locator("#bulkSubject")).toHaveValue("");
    await expect(page.locator("#bulkMinutes")).toHaveValue("");
  });

  test('"เลือกทั้งหมดที่เห็น" ทำงานร่วมกับตัวกรองรายการ', async ({ page }) => {
    await openAdmin(page);
    // กรองเหลือเฉพาะวิชาคณิตศาสตร์ (เกม C)
    await page.selectOption("#listSubjectFilter", "คณิตศาสตร์");
    await expect(page.locator(".admin-list-item")).toHaveCount(1);

    await page.locator("#selectAllVisible").check();
    await expect(page.locator("#bulkCount")).toHaveText("เลือกไว้ 1 เกม");

    // ล้างตัวกรอง → ยังเลือกแค่ C เกมเดียว (ไม่ลามไปทั้งหมด)
    await page.selectOption("#listSubjectFilter", "");
    await expect(page.locator(".admin-list-item")).toHaveCount(3);
    await expect(page.locator("#bulkCount")).toHaveText("เลือกไว้ 1 เกม");
    await expect(itemCheckbox(page, "เกม C")).toBeChecked();
    await expect(itemCheckbox(page, "เกม A")).not.toBeChecked();
  });

  test("ลบหลายเกมพร้อมกัน + เลิกทำได้", async ({ page }) => {
    await openAdmin(page);
    await itemCheckbox(page, "เกม A").check();
    await itemCheckbox(page, "เกม B").check();
    await page.locator("#bulkDelete").click();

    await expect(page.locator(".admin-list-item")).toHaveCount(1);
    await expect(page.locator("#snackbar")).toContainText("ลบ 2 เกมแล้ว");

    await page.locator("#snackbarAction").click();
    await expect(page.locator(".admin-list-item")).toHaveCount(3);
    // คืนลำดับเดิมด้วย
    expect(await page.locator(".li-title").allTextContents()).toEqual(["เกม A", "เกม B", "เกม C"]);
  });
});

test.describe("E2 — ผลตรวจลิงก์เสีย", () => {
  test("อ่าน link-status.json แล้วขึ้น ⚠️ บนเกมที่ลิงก์เปิดไม่ได้", async ({ page }) => {
    await page.route("**/link-status.json", (r) =>
      r.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          checkedAt: "2026-07-20T01:00:00.000Z",
          games: { a: { ok: true, status: "HTTP 200" }, b: { ok: false, status: "HTTP 404" } },
        }),
      })
    );
    await openAdmin(page);

    await expect(page.locator("#linkStatusNote")).toContainText("พบลิงก์เปิดไม่ได้ 1 เกม");
    await expect(page.locator("#linkStatusNote")).toContainText("2026-07-20");
    // ⚠️ ขึ้นแค่เกม B
    const bItem = page.locator(".admin-list-item", { hasText: "เกม B" });
    await expect(bItem.locator(".li-warn")).toBeVisible();
    await expect(page.locator(".admin-list-item", { hasText: "เกม A" }).locator(".li-warn")).toHaveCount(0);
  });

  test("ไม่มีไฟล์ผลตรวจ → ไม่แจ้งอะไร ไม่พัง", async ({ page }) => {
    await page.route("**/link-status.json", (r) => r.fulfill({ status: 404, body: "" }));
    await openAdmin(page);
    await expect(page.locator("#linkStatusNote")).toBeHidden();
    await expect(page.locator(".admin-list-item")).toHaveCount(3);
  });
});
