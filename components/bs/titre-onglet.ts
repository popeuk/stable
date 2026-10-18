"use client";

import { useEffect } from "react";

/**
 * Le titre de l'onglet du navigateur quand un même écran montre plusieurs
 * pages (Clients ou Chevaux, les pages de réglages) : « Chevaux · Be Stable ».
 * Next repose le titre de l'écran après coup : on le remet tant que la page
 * est ouverte. Sans titre (null), rien ne change.
 */
export function useTitreOnglet(titre: string | null) {
  useEffect(() => {
    if (!titre) return;
    const plein = `${titre} · Be Stable`;
    const avant = document.title;
    const poser = () => {
      if (document.title !== plein) document.title = plein;
    };
    poser();
    const mo = new MutationObserver(poser);
    mo.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      mo.disconnect();
      // Rendu au titre de l'écran, s'il n'a pas déjà changé (autre écran).
      if (document.title === plein) document.title = avant;
    };
  }, [titre]);
}
