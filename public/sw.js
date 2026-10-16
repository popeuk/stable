/* Be Stable, service worker.
   Il vit à la racine de l'app (par exemple /stable/sw.js) et en déduit sa
   base : l'app s'installe et s'ouvre hors ligne, sur téléphone comme sur
   ordinateur. Les données de l'écurie sont dans le navigateur, pas ici.
   - pages : le réseau d'abord, la copie en cache si pas de réseau ;
   - fichiers de build (/_next/static/, noms hachés) : le cache d'abord ;
   - images, icônes, manifeste (noms fixes) : la copie en cache tout de
     suite, et la version du réseau rangée pour la fois suivante.
   La version du cache change à chaque build : scripts/stamp-sw.mjs remplace
   __BUILD_ID__ dans out/sw.js après « next build ». À l'activation, tous
   les autres caches sont supprimés. */

const VERSION = "be-stable-__BUILD_ID__";
const BASE = new URL(self.registration.scope).pathname; // « /stable/ » ou « / »
const SHELL = ["", "accueil/", "planning/", "chevaux/", "argent/", "valider/", "equipe/", "clients/", "manifest.webmanifest", "icon-192.png"].map((p) => BASE + p);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })))))
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

/** Une page se range sans sa requête (?id=, ?nom=) : une seule copie par écran. */
const pageKey = (url) => url.origin + url.pathname;

function put(key, res) {
  if (!res || !res.ok) return;
  const copy = res.clone();
  caches.open(VERSION).then((c) => c.put(key, copy));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (url.pathname === BASE + "sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          put(pageKey(url), res);
          return res;
        })
        .catch(() =>
          caches
            .match(pageKey(url))
            .then((r) => r || caches.match(BASE + "accueil/"))
            .then((r) => r || caches.match(BASE)),
        ),
    );
    return;
  }

  // Fichiers de build : leur nom change avec leur contenu, le cache d'abord.
  if (url.pathname.startsWith(BASE + "_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            put(request, res);
            return res;
          }),
      ),
    );
    return;
  }

  // Images, icônes, manifeste : noms fixes, on sert la copie et on la rafraîchit.
  if (/\.(png|svg|jpe?g|webp|avif|gif|ico|woff2?|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fresh = fetch(request)
          .then((res) => {
            put(request, res);
            return res;
          })
          .catch(() => cached || Response.error());
        if (cached) {
          event.waitUntil(fresh);
          return cached;
        }
        return fresh;
      }),
    );
  }
});
