// Bump this when you change index.html/manifest/icon so clients pick up the new shell.
const CACHE_NAME = "orc-shell-v2";

const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (name) { return name !== CACHE_NAME; })
          .map(function (name) { return caches.delete(name); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  const url = new URL(event.request.url);

  // Never intercept OpenRouter (or any cross-origin) traffic — chat must always hit the network.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Only handle simple same-origin GETs for the app shell; let everything else pass through.
  if (event.request.method !== "GET") {
    return;
  }

  // Stale-while-revalidate: serve the cached shell immediately, refresh it in the background.
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      const network = fetch(event.request)
        .then(function (response) {
          if (response && response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then(function (cache) { return cache.put(event.request, copy); })
            );
          }
          return response;
        })
        .catch(function () {
          return cached || new Response("Offline and not cached.", {
            status: 503,
            headers: { "Content-Type": "text/plain" }
          });
        });
      return cached || network;
    })
  );
});
