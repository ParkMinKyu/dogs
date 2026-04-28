/* 우리 강아지 — Service Worker
   offline-first cache. 새 버전 배포 시 CACHE 이름 bump. */
const CACHE = 'dogs-v2-v204';
const PRECACHE = [
  './',
  'index.html',
  'style.css',
  'game.js',
  'manifest.json',
  'assets/puppy/idle.png',
  'assets/puppy/happy.png',
  'assets/puppy/eating.png',
  'assets/puppy/sad.png',
  'assets/puppy/sleeping.png',
  'assets/teen/idle.png',
  'assets/teen/happy.png',
  'assets/teen/eating.png',
  'assets/teen/sad.png',
  'assets/teen/sleeping.png',
  'assets/adult/idle.png',
  'assets/adult/happy.png',
  'assets/adult/eating.png',
  'assets/adult/sad.png',
  'assets/adult/sleeping.png',
  'assets/cat_yellow/idle.png',
  'assets/cat_yellow/happy.png',
  'assets/cat_yellow/eating.png',
  'assets/cat_yellow/sad.png',
  'assets/cat_yellow/sleeping.png',
  'assets/cat_black/idle.png',
  'assets/cat_black/happy.png',
  'assets/cat_black/eating.png',
  'assets/cat_black/sad.png',
  'assets/cat_black/sleeping.png',
  'assets/cat_gray/idle.png',
  'assets/cat_gray/happy.png',
  'assets/cat_gray/eating.png',
  'assets/cat_gray/sad.png',
  'assets/cat_gray/sleeping.png',
  'assets/rabbit_white/idle.png',
  'assets/rabbit_white/happy.png',
  'assets/rabbit_white/eating.png',
  'assets/rabbit_white/sad.png',
  'assets/rabbit_white/sleeping.png',
  'assets/rabbit_brown/idle.png',
  'assets/rabbit_brown/happy.png',
  'assets/rabbit_brown/eating.png',
  'assets/rabbit_brown/sad.png',
  'assets/rabbit_brown/sleeping.png',
  'assets/hamster/idle.png',
  'assets/hamster/happy.png',
  'assets/hamster/eating.png',
  'assets/hamster/sad.png',
  'assets/hamster/sleeping.png',
  'assets/breeds/shiba.png',
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

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 외부 폰트 등은 네트워크-우선
  if (url.origin !== self.location.origin) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }
  // 동일 출처: cache-first
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
