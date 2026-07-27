// @ts-check
const { defineConfig, devices } = require("@playwright/test");

/**
 * รัน static site ด้วย python http.server แล้วทดสอบด้วย Chromium
 * เดสก์ท็อป + มือถือ (สองโปรเจกต์)
 */
module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:8000",
    trace: "on-first-retry",
    // ปิด service worker ในเทสต์ทั่วไป กันแคชมากวน route ที่ mock games.js/announcement.js
    // (เทสต์ PWA จะเปิดเองด้วย test.use)
    serviceWorkers: "block",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: "python3 -m http.server 8000 --bind 127.0.0.1",
    url: "http://127.0.0.1:8000/index.html",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
