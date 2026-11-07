// 讓「加到主畫面」後可離線開啟，並啟用 Android 的分享目標。先抓網路，失敗才用快取。
const CACHE = 'social-links-v1';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(url.pathname === new URL('./', location).pathname ? './' : e.request, copy));
      return r;
    }).catch(() => caches.match(url.searchParams.has('share') ? './' : e.request))
  );
});
