/* v300 — 音效网络优先；避免大 wav 被坏缓存卡死无声 */
const CACHE = "kanshan-v300";
const SHELL = ["./cover-mobile.jpg?v=300", "./cover.jpg?v=300"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isImage(url) {
  return /\.(?:jpg|jpeg|png|webp|gif)$/i.test(url.pathname);
}

function isAudio(url) {
  return /\.(?:wav|mp3|ogg|m4a)$/i.test(url.pathname);
}

function networkFirstDoc(url) {
  const p = url.pathname;
  return (
    p.includes("boot.js") ||
    p.includes("hot-cache") ||
    p.includes("hot-seed") ||
    p.endsWith(".html") ||
    p === "/"
  );
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // HTML / boot / 热榜 / 音效：网络优先（音效大文件缓存优先易无声）
  if (req.mode === "navigate" || networkFirstDoc(url) || isAudio(url)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && isAudio(url)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then(
            (hit) =>
              hit ||
              caches.match("./index.html").then((h) => h || caches.match("/index.html"))
          )
        )
    );
    return;
  }

  // 图片：缓存优先，后台更新
  if (isImage(url) || /\.json$/i.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || net;
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || net;
    })
  );
});
