// @ts-check
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

// ตรวจ accessibility ระดับ WCAG A/AA — ต้องไม่มี violation ระดับ critical/serious
async function auditNoSerious(page, url) {
  await page.goto(url);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );
  const summary = serious.map((v) => v.id + " (" + v.impact + ")").join(", ");
  expect(serious, "axe violations: " + summary).toEqual([]);
}

test("index.html ผ่าน axe (ไม่มี critical/serious)", async ({ page }) => {
  await auditNoSerious(page, "/index.html");
});

test("admin.html ผ่าน axe (ไม่มี critical/serious)", async ({ page }) => {
  await auditNoSerious(page, "/admin.html");
});
