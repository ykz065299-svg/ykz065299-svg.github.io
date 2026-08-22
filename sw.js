/* v180 — 网络优先：HTML/boot/热榜不读旧缓存；封面离线兜底 */
const CACHE = "kanshan-v180";
const SHELL = ["./cover-mobile.jpg?v=106", "./cover.jpg?v=106"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
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

function networkFirst(url) {
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

  const isNav = req.mode === "navigate" || networkFirst(url);

  if (isNav) {
    e.respondWith(
      fetch(req).catch(() =>
        caches.match("./index.html").then((hit) => hit || caches.match("/index.html"))
      )
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
