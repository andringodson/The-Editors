/*
 * Service worker.
 *
 * Because every browser-based tool is pure client-side computation, this app is
 * genuinely useful with no network at all — the only thing standing between it
 * and full offline operation is having the HTML and JS on disk. That is what
 * this file does.
 *
 * Strategies, and why:
 *
 *   navigation      network-first, cache fallback. Tool pages change between
 *                   deploys; serving a stale shell would strand users on an old
 *                   build indefinitely.
 *   /_next/static   cache-first. Content-hashed and immutable, so a hit is
 *                   always correct and revalidating would be pure latency.
 *   /api, /auth     never cached. Auth state and token minting must not be
 *                   answered from disk.
 */

const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;

const SHELL_ROUTES = [
  "/",
  "/tools/compress",
  "/tools/passport",
  "/tools/crop",
  "/tools/upscale",
  "/tools/format",
  "/tools/pdf-merge",
  "/tools/images-to-pdf",
  "/offline",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Individually, so one 404 cannot fail the whole install.
      Promise.allSettled(SHELL_ROUTES.map((route) => cache.add(route))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheable(url) {
  return (
    url.origin === self.location.origin &&
    !url.pathname.startsWith("/api/") &&
    !url.pathname.startsWith("/auth/") &&
    !url.pathname.startsWith("/account") &&
    !url.pathname.startsWith("/login")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isCacheable(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? (await caches.match("/offline")) ?? Response.error();
        }),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icon")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            void caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});
