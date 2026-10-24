/* Strong & Steady offline support (cache-first). Updates are fetched by the page: see checkForUpdate in app.js. */
var CACHE = "steady-app";
var FILES = ["./", "index.html", "app.js", "data.js", "games.js", "words.js", "style.css", "manifest.webmanifest", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "fonts/AtkinsonHyperlegible-Bold.ttf", "fonts/AtkinsonHyperlegible-Italic.ttf", "fonts/AtkinsonHyperlegible-Regular.ttf"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) { return fetch(f, { cache: "no-store" }).then(function (r) { if (r.ok) return c.put(f, r); }); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (x) { return x !== CACHE; }).map(function (x) { return caches.delete(x); })); })
    .then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.endsWith("version.json") || url.search.indexOf("t=") >= 0) return;
  if (req.mode === "navigate") {
    e.respondWith(caches.open(CACHE).then(function (c) { return c.match("index.html").then(function (hit) { return hit || fetch(req); }); }));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || fetch(req); }));
});
