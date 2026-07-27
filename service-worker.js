/* Service Worker — แคชหน้า hub ให้เปิดได้แม้เน็ตไม่เสถียร
   - ข้อมูล (games.js/announcement.js): network-first (ได้ของล่าสุด, ออฟไลน์ใช้แคช)
   - shell (html/css/js/ไอคอน): stale-while-revalidate (เร็ว + อัปเดตเบื้องหลัง)
   - cross-origin (เกม GAS ฯลฯ): ปล่อยผ่าน ไม่ยุ่ง
   ตัวเกมเป็น external จึงยังต้องมีเน็ตตอนเล่น */
const VERSION = "v1";
const CACHE = "gamehub-" + VERSION;
const SHELL = [
  "./", "index.html", "style.css", "app.js", "games.js", "announcement.js",
  "manifest.webmanifest", "icon-192.png", "icon-512.png",
];
const DATA = /\/(games|announcement)\.js(\?|$)/;

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SHELL.map(function (u) {
        return c.add(u).catch(function () { /* ข้ามไฟล์ที่ add ไม่ได้ */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ปล่อย cross-origin (เกม GAS)

  if (DATA.test(url.pathname)) {
    // network-first: ได้ข้อมูลล่าสุด, ล้มเหลวค่อยใช้แคช
    e.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  // shell: stale-while-revalidate
  e.respondWith(
    caches.match(req).then(function (cached) {
      const net = fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return cached; });
      return cached || net;
    })
  );
});
