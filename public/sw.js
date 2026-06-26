/* LockIn service worker (web only — NOT registered in the native app).
 *
 * Network-first for document navigations and APIs; cache-first ONLY for
 * immutable, content-hashed build assets. It never serves a stale HTML shell
 * (that caused post-deploy net::ERR_FAILED reload loops, because a cached /app
 * shell referenced chunk hashes that 404 after a redeploy) and never caches a
 * redirected response (Chromium fails navigations served a redirected Response
 * from a SW). Cache name bumped to purge the poisoned v1 cache on activate.
 */
const CACHE = "lockin-v2";
const PRECACHE = ["/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

// Only reuse responses that are safe to cache: OK, same-origin, NOT redirected.
function cacheable(res) {
  return res && res.ok && !res.redirected && res.type === "basic";
}

function putInCache(request, res) {
  if (!cacheable(res)) return;
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin alone

  // Document navigations (e.g. /app): NETWORK-FIRST. Never serve a stale shell;
  // fall back to cache only when the network is unavailable.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          putInCache(request, res);
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Immutable, content-hashed build assets: CACHE-FIRST (safe — URL changes on
  // every build, so a cached entry can never go stale).
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            putInCache(request, res);
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else (APIs, manifest, icons): NETWORK-FIRST, cache as an offline
  // fallback only.
  event.respondWith(
    fetch(request)
      .then((res) => {
        putInCache(request, res);
        return res;
      })
      .catch(() => caches.match(request)),
  );
});
