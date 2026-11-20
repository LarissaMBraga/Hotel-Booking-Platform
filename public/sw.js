const CACHE_NAME = "maison-shell-v2";
const BASE_PATH = new URL("./", self.registration.scope).pathname;

const APP_SHELL = [
  BASE_PATH,
  `${BASE_PATH}manifest.webmanifest`,
  `${BASE_PATH}maison-icon.svg`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const isAppAsset =
          url.pathname.startsWith(`${BASE_PATH}assets/`) ||
          APP_SHELL.some(
            (path) => url.pathname === new URL(path, self.location.origin).pathname,
          );

        if (response.ok && isAppAsset) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) =>
            cache.put(event.request, copy),
          );
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);

        if (cached) return cached;

        if (event.request.mode === "navigate") {
          return (
            (await caches.match(
              new URL(BASE_PATH, self.location.origin).toString(),
            )) || Response.error()
          );
        }

        return Response.error();
      }),
  );
});
