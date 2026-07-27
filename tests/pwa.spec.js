// @ts-check
const { test, expect } = require("@playwright/test");

test.describe("Phase C — PWA + SEO", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/announcement.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: "window.ANNOUNCEMENT={enabled:false};" })
    );
  });

  test("manifest ถูกต้อง + มีไอคอน", async ({ page, request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
    const m = await res.json();
    expect(m.name).toBeTruthy();
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBeTruthy();
    expect(m.icons.length).toBeGreaterThanOrEqual(2);
    expect(m.icons.some((i) => i.purpose === "maskable")).toBeTruthy();
  });

  test("head มี OG/Twitter/theme-color/canonical/manifest + JSON-LD", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "manifest.webmanifest");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#4f8ef7");
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    const ogImg = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImg).toContain("og-image.png");
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    // JSON-LD ItemList ถูก inject
    const ld = await page.locator('script[type="application/ld+json"]').textContent();
    expect(ld).toContain("ItemList");
  });

  test("robots.txt กันหน้า admin + sitemap มี hub url", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin.html");
    expect(robots).toContain("Sitemap:");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("allgamespnp");
  });
});

test.describe("Phase C — service worker", () => {
  test.use({ serviceWorkers: "allow" });
  test("service worker ลงทะเบียนสำเร็จ", async ({ page }) => {
    await page.route("**/announcement.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: "window.ANNOUNCEMENT={enabled:false};" })
    );
    await page.goto("/index.html");
    await page.waitForFunction(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      return !!r;
    }, null, { timeout: 10000 });
    expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()))).toBeTruthy();
  });
});
