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

// 请求：缓存优先（核心文件），网络优先（音乐/视频/音效），其他回退缓存
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // 音乐/视频/音效：网络优先，失败时用缓存
  if (/\.(mp3|mp4|flac)$/i.test(url.pathname)) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 核心文件：缓存优先，失败时走网络
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
