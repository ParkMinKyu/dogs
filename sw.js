/* 우리 친구 — Service Worker
   offline-first. HTML/JS/CSS는 network-first로 항상 최신 받음. */
const CACHE = 'dogs-v3-v307';
const PRECACHE = [
  './',
  'index.html',
  'style.css',
  'game.js',
  'manifest.json',
  'assets/icons/icon-256.png',
  'assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// 코드/HTML/CSS는 network-first (항상 최신), 이미지/폰트는 cache-first
function isCodeAsset(url) {
  return /\.(html|js|css|json)$/i.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/');
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }
  if (isCodeAsset(url)) {
    // network-first — 새 코드 즉시 반영, 오프라인에선 캐시
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req).then(c => c || caches.match('index.html')))
    );
    return;
  }
  // 이미지/폰트 등: cache-first
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('index.html'));
    })
  );
});
