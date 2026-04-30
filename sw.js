/* 우리 친구 — Service Worker
   offline-first. HTML/JS/CSS는 network-first로 항상 최신 받음.
   sprite/items/preview/icons는 install 시점에 일괄 precache → 오프라인에서 sprite 전환 시 404 방지. */
const CACHE = 'dogs-v3-v309';

// 첫 진입 시 즉시 캐시 (HTML/CSS/JS/manifest)
const CORE = [
  './',
  'index.html',
  'style.css',
  'game.js',
  'manifest.json',
];

// 이미지 자산 — 오프라인에서도 sprite 전환 가능하도록 install 시점에 일괄 캐시.
// addAll은 한 개라도 실패하면 전체 실패하므로 개별 add로 처리 (안전).
const ASSETS = [
  'assets/adult/eating.png',
  'assets/adult/happy.png',
  'assets/adult/idle.png',
  'assets/adult/sad.png',
  'assets/adult/sleeping.png',
  'assets/bichon/eating.png',
  'assets/bichon/happy.png',
  'assets/bichon/idle.png',
  'assets/bichon/sad.png',
  'assets/bichon/sleeping.png',
  'assets/breeds/bichon.png',
  'assets/breeds/cat_black.png',
  'assets/breeds/cat_yellow.png',
  'assets/breeds/hamster.png',
  'assets/breeds/husky.png',
  'assets/breeds/maltese.png',
  'assets/breeds/rabbit_white.png',
  'assets/breeds/shiba.png',
  'assets/cat_black/eating.png',
  'assets/cat_black/happy.png',
  'assets/cat_black/idle.png',
  'assets/cat_black/sad.png',
  'assets/cat_black/sleeping.png',
  'assets/cat_yellow/eating.png',
  'assets/cat_yellow/happy.png',
  'assets/cat_yellow/idle.png',
  'assets/cat_yellow/sad.png',
  'assets/cat_yellow/sleeping.png',
  'assets/hamster/eating.png',
  'assets/hamster/happy.png',
  'assets/hamster/idle.png',
  'assets/hamster/sad.png',
  'assets/hamster/sleeping.png',
  'assets/husky/eating.png',
  'assets/husky/happy.png',
  'assets/husky/idle.png',
  'assets/husky/sad.png',
  'assets/husky/sleeping.png',
  'assets/icons/icon-1024.png',
  'assets/icons/icon-144.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-256.png',
  'assets/icons/icon-48.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-72.png',
  'assets/icons/icon-96.png',
  'assets/items/balloon.png',
  'assets/items/bed.png',
  'assets/items/bird.png',
  'assets/items/bone.png',
  'assets/items/bookshelf.png',
  'assets/items/butter.png',
  'assets/items/chair.png',
  'assets/items/fl_roll.png',
  'assets/items/flower.png',
  'assets/items/gem.png',
  'assets/items/gift.png',
  'assets/items/lamp.png',
  'assets/items/mirror.png',
  'assets/items/pee.png',
  'assets/items/picture.png',
  'assets/items/plant.png',
  'assets/items/poop.png',
  'assets/items/sofa.png',
  'assets/items/star.png',
  'assets/items/tv.png',
  'assets/items/wp_roll.png',
  'assets/maltese/eating.png',
  'assets/maltese/happy.png',
  'assets/maltese/idle.png',
  'assets/maltese/sad.png',
  'assets/maltese/sleeping.png',
  'assets/preview/adult_eating_8x.png',
  'assets/preview/adult_happy_8x.png',
  'assets/preview/adult_idle_8x.png',
  'assets/preview/adult_sad_8x.png',
  'assets/preview/adult_sleeping_8x.png',
  'assets/preview/eating_8x.png',
  'assets/preview/happy_8x.png',
  'assets/preview/idle_8x.png',
  'assets/preview/sad_8x.png',
  'assets/preview/sleeping_8x.png',
  'assets/preview/teen_eating_8x.png',
  'assets/preview/teen_happy_8x.png',
  'assets/preview/teen_idle_8x.png',
  'assets/preview/teen_sad_8x.png',
  'assets/preview/teen_sleeping_8x.png',
  'assets/rabbit_white/eating.png',
  'assets/rabbit_white/happy.png',
  'assets/rabbit_white/idle.png',
  'assets/rabbit_white/sad.png',
  'assets/rabbit_white/sleeping.png',
  'assets/shiba/eating.png',
  'assets/shiba/happy.png',
  'assets/shiba/idle.png',
  'assets/shiba/sad.png',
  'assets/shiba/sleeping.png',
  'assets/teen/eating.png',
  'assets/teen/happy.png',
  'assets/teen/idle.png',
  'assets/teen/sad.png',
  'assets/teen/sleeping.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // CORE는 통합 addAll (실패 시 install 실패 — 게임 자체가 안 돌아가니 의도적)
    try { await cache.addAll(CORE); } catch (err) { /* CORE 실패해도 SW는 살리되 다음 fetch에서 회복 */ }
    // ASSETS는 개별 add — 일부 누락되어도 install 자체는 성공
    await Promise.all(ASSETS.map(u =>
      cache.add(u).catch(() => {})
    ));
  })());
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
  // 이미지/폰트 등: cache-first → 캐시에 있으면 즉시, 없으면 네트워크 받아서 캐시 채우기
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
