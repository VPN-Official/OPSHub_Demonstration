self.addEventListener("install", (e) => {
  console.log("Service Worker: Installed");
  e.waitUntil(
    caches.open("opshub-cache-v1").then((cache) => {
      return cache.addAll(["/", "/index.html", "/manifest.json"]);
    })
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((resp) => {
      return (
        resp ||
        fetch(e.request).catch(() =>
          new Response("Offline fallback", { status: 503 })
        )
      );
    })
  );
});