// L'app a quitté cette adresse pour app.bestable.fr (18 octobre 2026).
// Ce service worker remplace l'ancien sur les appareils qui l'avaient installé :
// il vide ses caches, se retire et recharge les pages ouvertes, qui partent
// alors vers app.bestable.fr.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) await caches.delete(k);
      await self.registration.unregister();
      for (const c of await self.clients.matchAll({ type: "window" })) c.navigate(c.url);
    })(),
  );
});
