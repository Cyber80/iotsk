// ==== SmartFarm SW (network-first for pages & scripts) ====
// !! เปลี่ยนเลขเวอร์ชันทุกครั้งที่อัปเดต
const VERSION = '2025-10-04-1';
const CACHE = `sf-cache-${VERSION}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './profile.html',
  './profile.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE_ASSETS)));
  self.skipWaiting(); // ใช้ SW ใหม่นี้ทันที
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// HTML/CSS/JS = network-first (ได้ไฟล์ใหม่ก่อน ถ้าเน็ตล่มค่อยใช้ cache)
// อื่น ๆ (รูป/ไอคอน/ฟอนต์) = cache-first
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const dest = req.destination; // 'document' | 'script' | 'style' | 'image' ...
  const isPageLike = dest === 'document' || dest === 'script' || dest === 'style';

  if (isPageLike) {
    e.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(req, clone));
        return res;
      }).catch(() => caches.match(req))
    );
  } else {
    e.respondWith(
      caches.match(req).then((hit) => {
        return hit || fetch(req).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
          return res;
        });
      })
    );
  }
});

// แจ้งหน้าเว็บให้รีโหลดเมื่อ SW ตัวใหม่ทำงาน
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});