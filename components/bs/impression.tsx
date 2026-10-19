"use client";

import { useEffect } from "react";

/**
 * Ce qu'un écran imprimé pose le temps qu'il est ouvert : le format de sa
 * page (`@page`), pour les navigateurs qui ne lisent pas les pages nommées
 * des feuilles de style, et le titre du document, qui devient aussi le nom
 * du PDF enregistré (« Facture 2026-0001 Hugo L. »). En quittant l'écran,
 * tout s'en va : aucun autre écran n'imprime au format du registre.
 */
export function PageImprimee({ page }: { page: string }) {
  return <style>{`@media print { @page { ${page} } }`}</style>;
}

/** Le titre du document pendant que l'écran est ouvert, rendu en partant. */
export function useTitreDocument(titre: string | undefined) {
  useEffect(() => {
    if (!titre) return;
    // Le titre que l'écran voudrait (métadonnées) : rendu en partant. En changeant
    // d'écran, Next pose le titre du suivant avant que celui-ci ne s'en aille :
    // on rend celui-là, pas « Facture · Be Stable » (Réglages s'appelait « Facture »).
    let voulu = document.title;
    document.title = titre;
    // Le titre de l'écran (métadonnées « Facture · Be Stable ») arrive parfois
    // après, au premier chargement : il ne doit pas reprendre la place du nom du PDF.
    const garder = () => {
      if (document.title === titre) return;
      voulu = document.title;
      document.title = titre;
    };
    const obs = new MutationObserver(garder);
    obs.observe(document.head, { childList: true, subtree: true, characterData: true });
    window.addEventListener("beforeprint", garder);
    return () => {
      obs.disconnect();
      window.removeEventListener("beforeprint", garder);
      document.title = voulu;
    };
  }, [titre]);
}
