/* Be Stable, service worker.
   Il vit à la racine de l'app (par exemple /stable/sw.js) et en déduit sa
   base : l'app s'installe et s'ouvre hors ligne, sur téléphone comme sur
   ordinateur. Les données de l'écurie sont dans le navigateur, pas ici.
   - pages : le réseau d'abord, la copie en cache si pas de réseau ; un écran
     jamais ouvert sur l'appareil reçoit la page « hors ligne » (jamais
     l'accueil sous un autre titre : React refuserait d'hydrater, erreur #418) ;
   - à l'installation : les écrans principaux et leurs fichiers de build sont
     rangés d'avance, pour qu'ils s'ouvrent sans réseau dès le premier jour ;
   - fichiers de build (/_next/static/, noms hachés) : le cache d'abord ;
   - images, icônes, manifeste (noms fixes) : la copie en cache tout de
     suite, et la version du réseau rangée pour la fois suivante.
   La version du cache change à chaque build : scripts/stamp-sw.mjs remplace
   __BUILD_ID__ dans out/sw.js après « next build ». À l'activation, tous
   les autres caches sont supprimés. */

const VERSION = "be-stable-__BUILD_ID__";
const BASE = new URL(self.registration.scope).pathname; // « /stable/ » ou « / »
const HORS_LIGNE = BASE + "hors-ligne.html";
/** Les écrans qu'on ouvre depuis la cour : rangés dès l'installation. */
const ECRANS = [
  "", "accueil/", "planning/", "chevaux/", "argent/", "valider/", "equipe/", "clients/", "client/", "ticket/",
  "cheval/", "contacts/", "prestations/", "moi/", "recherche/", "pilotage/", "facture/", "facturation/", "registre/",
  "ma-fiche/", "seuil/", "part/", "ecurie/", "parcours/factures/", "parcours/tarifs/", "saisie/cheval/", "reglages/",
].map((p) => BASE + p);
const FICHIERS = ["manifest.webmanifest", "icon-192.png", "img/carnet/hors-ligne.webp", "img/carnet/gerant-hors-ligne.webp"].map((p) => BASE + p);

/** Les fichiers de build que cite une page (scripts, feuilles de style, polices). */
const citesPar = (html) => [...new Set([...html.matchAll(/_next\/static\/[^"'()\s\\]+?\.(?:js|css|woff2)/g)].map((m) => BASE + m[0]))];

async function ranger() {
  const c = await caches.open(VERSION);
  await Promise.allSettled([...FICHIERS, HORS_LIGNE].map((u) => c.add(new Request(u, { cache: "reload" }))));
  const pages = await Promise.allSettled(
    [HORS_LIGNE, ...ECRANS].map(async (u) => {
      const res = await fetch(new Request(u, { cache: "reload" }));
      if (!res.ok) return [];
      if (u !== HORS_LIGNE) await c.put(u, res.clone());
      return citesPar(await res.text());
    }),
  );
  const build = [...new Set(pages.flatMap((p) => (p.status === "fulfilled" ? p.value : [])))];
  await Promise.allSettled(build.map(async (u) => (await c.match(u)) || c.add(u)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(ranger().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** La page « hors ligne », avec la base de l'app (elle est servie sous l'adresse de l'écran demandé). */
async function horsLigne() {
  const r = await caches.match(HORS_LIGNE);
  if (!r) return Response.error();
  const html = (await r.text()).replaceAll("{{BASE}}", BASE);
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

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
        .catch(() => caches.match(pageKey(url)).then((r) => r || horsLigne())),
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
