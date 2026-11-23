// Bump the cache version whenever a file in the app shell changes.
const CACHE = "dumsor-planner-shell-v1";
const SCOPE = self.registration.scope;
const SHELL = [
  "index.html",
  "styles.css",
  "app.mjs",
  "logic.mjs",
  "assets/accra-dusk.webp",
  "assets/icon.png",
  "assets/instrument-sans.woff2",
].map((file) => new URL(file, SCOPE).href);
const INDEX = SHELL[0];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) =>
    cache.addAll(SHELL.map((url) => new Request(url, { cache: "reload" })))));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("dumsor-planner-shell-") && key !== CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const canonical = url.origin + url.pathname;
  const appPage = request.mode === "navigate" && (canonical === SCOPE || canonical === INDEX);
  if (!appPage && !SHELL.includes(request.url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(appPage ? INDEX : request);
    return cached ?? fetch(request);
  })());
});
