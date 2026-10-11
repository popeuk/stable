/* Be Stable, service worker.
   Il vit à la racine de l'app (par exemple /stable/sw.js) et en déduit sa
   base : l'app s'installe et s'ouvre hors ligne, sur téléphone comme sur
   ordinateur. Les données de l'écurie sont dans le navigateur, pas ici.
   - pages : le réseau d'abord, la copie en cache si pas de réseau ;
   - fichiers statiques : le cache d'abord. */

const VERSION = "be-stable-v3";
const BASE = new URL(self.registration.scope).pathname; // « /stable/ » ou « / »
const SHELL = ["", "accueil/", "planning/", "chevaux/", "argent/", "valider/", "equipe/", "clients/", "manifest.webmanifest", "icon-192.png"].map((p) => BASE + p);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(request, { ignoreSearch: true })
            .then((r) => r || caches.match(BASE + "accueil/"))
            .then((r) => r || caches.match(BASE)),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && (url.pathname.includes("/_next/") || /\.(png|svg|jpg|woff2?|css|js|ico|webmanifest)$/.test(url.pathname))) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
