const SHELL_CACHE = "college-study-hub-shell-v3";
const SHELL_URLS = ["/", "/manifest.webmanifest", "/icons/study-hub.svg"];
const ASSET_PATH = /^\/assets\/[a-zA-Z0-9._-]+\.(?:js|mjs|css|svg|woff2?|png|jpe?g|webp|avif|gif)$/;

async function cacheApplicationShell() {
  const cache = await caches.open(SHELL_CACHE);
  const response = await fetch("/");
  if (!response.ok) throw new Error("The application shell could not be downloaded.");
  await cache.put("/", response.clone());
  const html = await response.text();
  const htmlAssets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((path) => typeof path === "string")
    .filter((path) => {
      const url = new URL(path, self.location.origin);
      return url.origin === self.location.origin && ASSET_PATH.test(url.pathname);
    });
  const manifestResponse = await fetch("/build-manifest.json");
  if (!manifestResponse.ok) throw new Error("The application asset list could not be downloaded.");
  const manifest = await manifestResponse.json();
  const manifestAssets = Object.values(manifest).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    return [entry.file, ...(Array.isArray(entry.css) ? entry.css : []), ...(Array.isArray(entry.assets) ? entry.assets : [])]
      .filter((path) => typeof path === "string")
      .map((path) => new URL(path, self.location.origin))
      .filter((url) => url.origin === self.location.origin && ASSET_PATH.test(url.pathname))
      .map((url) => url.pathname);
  });
  const staticAssets = [...new Set([...htmlAssets, ...manifestAssets])];
  await cache.addAll([...SHELL_URLS.slice(1), ...staticAssets]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    cacheApplicationShell()
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("college-study-hub-") && key !== SHELL_CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const shell = await caches.match("/");
        if (!shell) throw new Error("The application shell is not available offline yet.");
        return shell;
      }),
    );
    return;
  }

  if (ASSET_PATH.test(url.pathname)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request, { ignoreVary: true });
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok && response.type === "basic") await cache.put(request, response.clone());
        return response;
      }),
    );
  }
});
