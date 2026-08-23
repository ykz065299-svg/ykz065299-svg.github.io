/* v296 — 图片网络优先；相对路径；失败不强缓存 */
const CACHE = "kanshan-v296";
const SHELL = ["./cover-mobile.jpg?v=295", "./cover.jpg?v=295"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))
      )
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

function networkFirst(url) {
  const p = url.pathname;
  return (
    p.includes("boot.js") ||
    p.includes("shake-curves") ||
    p.includes("hot-cache") ||
    p.includes("hot-seed") ||
    p.endsWith(".html") ||
    p === "/" ||
    /\.(?:jpg|jpeg|png|webp|gif|svg)$/i.test(p)
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
      fetch(req)
        .then((res) => {
          if (res.ok && /\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname)) {
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
