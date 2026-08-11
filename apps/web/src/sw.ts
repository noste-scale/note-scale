// @ts-nocheck -- Build-time template; Vite config substitutes placeholders.
const CACHE_PREFIX = "notescale-";
const CACHE = __CACHE__;
const PRECACHE = __PRECACHE__;
const BASE = __BASE__;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all([
    ...keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)),
    self.clients.claim(),
  ])));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const responsePromise = (async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request, { ignoreVary: true });
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok && new URL(event.request.url).origin === location.origin) {
        await cache.put(event.request, response.clone()).catch(() => undefined);
      }
      return response;
    } catch (error) {
      if (event.request.mode === "navigate") {
        const shell = await cache.match(`${BASE}index.html`, { ignoreVary: true });
        if (shell) return shell;
      }
      throw error;
    }
  })();
  event.respondWith(responsePromise);
  event.waitUntil(responsePromise.then(() => undefined, () => undefined));
});
