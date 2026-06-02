const CACHE = 'bunny-vs-cake-v1';
const ASSETS = [
  '.',
  'index.html',
  'style.css',
  'script.js',
  'manifest.json',
];

// 安装：预缓存核心文件
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 请求：核心文件缓存优先，媒体文件缓存优先（首次下载后离线秒开）
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // 音乐/视频/音效：缓存优先，未命中时网络获取并缓存
  if (/\.(mp3|mp4|flac|png|jpg|gif)$/i.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // 核心文件：缓存优先，失败时走网络
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
