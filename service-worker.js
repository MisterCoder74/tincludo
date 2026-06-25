// Ti Includo — Service Worker (Offline-first base)
const CACHE = "tiincludo-v1";
const FALLBACK = "./dashboard.html";

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll([
        "./dashboard.html",
        "./login.html",
        "./styles.css",
        "./app.js",
        "./manifest.webmanifest",
        "./dizionario.json",
        "./news-fallback.json",
      ])
    )
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request)).catch(() => caches.match(FALLBACK))
  );
});