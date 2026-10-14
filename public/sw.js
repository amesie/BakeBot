// KD Pops service worker (spec 7.7, Offline NFR, REQ-25).
//
// - App shell and menu: the home page HTML (which includes the menu) and its
//   hashed /_next/static files are cached at install, so the site opens with
//   no signal after one visit.
// - Pages: network first, falling back to the cached copy when offline.
// - /_next/static: cache first (file names change whenever content changes).
// - /api: never cached. Orders made offline wait in IndexedDB instead (REQ-25).
//
// Bump VERSION to force every phone to drop old caches.
const VERSION = "kdpops-v1";
const SHELL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      const response = await fetch(SHELL, { cache: "reload" });
      await cache.put(SHELL, response.clone());
      // Also cache the scripts, styles and fonts the shell needs.
      const html = await response.text();
      const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) ?? [])];
      await Promise.all(assets.map((url) => cache.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== VERSION) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || url.pathname.startsWith("/dashboard")) {
    return; // always live; staff pages and APIs are never cached here
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(VERSION)).put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    // Keep the latest home page (with the menu) for offline use. Status
    // pages are cached by path only; the private token after # is never sent.
    if (response.ok) cache.put(new URL(request.url).pathname, response.clone());
    return response;
  } catch {
    const path = new URL(request.url).pathname;
    return (await cache.match(path)) ?? (await cache.match(SHELL)) ?? Response.error();
  }
}
