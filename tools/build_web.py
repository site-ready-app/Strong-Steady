"""Build Strong & Steady's web files into docs/.

docs/ is used twice: the Android app is packaged from it (Capacitor's webDir), and GitHub Pages can serve it
as a web version (Settings -> Pages -> main branch, /docs folder). Stamps a build ID so installed web copies
update themselves, and writes docs/version.json.
Run from the project folder:  python3 tools/build_web.py
"""
import hashlib, json, re, shutil, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
app, out = root / "app", root / "docs"
if out.exists(): shutil.rmtree(out)
shutil.copytree(app, out)
src = "".join((app / f).read_text(encoding="utf-8") for f in ["index.html", "app.js", "data.js", "games.js", "words.js", "style.css"])
version = re.search(r'APP_VERSION="([^"]+)"', src).group(1)
build = hashlib.sha256(src.encode("utf-8")).hexdigest()[:12]
idx = out / "index.html"
idx.write_text(idx.read_text(encoding="utf-8").replace("<!--BUILD-->", '<script>window.SITE_BUILD="%s";</script>' % build), encoding="utf-8")
(out / "version.json").write_text(json.dumps({"version": version, "build": build}), encoding="utf-8")
(out / "manifest.webmanifest").write_text(json.dumps({
    "name": "Strong & Steady", "short_name": "Steady",
    "description": "Gentle guided exercises for strength and balance, with stars, streaks and treats.",
    "start_url": "./", "scope": "./", "display": "standalone", "background_color": "#faf6ee", "theme_color": "#0e5a57", "lang": "en-GB",
    "icons": [{"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
              {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
              {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}, indent=1), encoding="utf-8")
files = ["./", "index.html", "app.js", "data.js", "games.js", "words.js", "style.css", "manifest.webmanifest"] + \
        ["icons/" + p.name for p in sorted((out / "icons").glob("*.png"))] + ["fonts/" + p.name for p in sorted((out / "fonts").glob("*.ttf"))]
(out / "sw.js").write_text("""/* Strong & Steady offline support (cache-first). Updates are fetched by the page: see checkForUpdate in app.js. */
var CACHE = "steady-app";
var FILES = %s;
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
""" % json.dumps(files), encoding="utf-8")
print("Built version", version, "build", build, "into docs/")
