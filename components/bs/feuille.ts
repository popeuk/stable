"use client";

import { useEffect, useRef, useState } from "react";
import { poserEntree, retirerEntree } from "@/lib/retour-feuille";

/**
 * Ce que toute feuille modale doit faire, en un seul endroit : prendre le
 * focus à l'ouverture, garder Tab à l'intérieur, se fermer à Échap, rendre le
 * focus à ce qui l'a ouverte. Les feuilles empilées (une feuille ouverte depuis
 * une autre) se ferment une à une : seule celle du dessus écoute le clavier.
 * Le bouton retour d'Android ou du navigateur ferme d'abord la feuille
 * (lib/retour-feuille).
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

const pile: object[] = [];

/** L'ordre de Tab dans la feuille : visible, pas retiré (tabindex -1), un seul bouton radio par groupe. */
const visibles = (el: HTMLElement) => {
  const vus = new Set<string>();
  return [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => {
    if (x.tabIndex < 0 || x.getClientRects().length === 0 || x.closest("[inert]")) return false;
    if (x instanceof HTMLInputElement && x.type === "radio" && x.name) {
      const groupe = [...el.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(x.name)}"]`)];
      const tenant = groupe.find((r) => r.checked) ?? groupe[0];
      if (x !== tenant || vus.has(x.name)) return false;
      vus.add(x.name);
    }
    return true;
  });
};

/** Un champ de saisie : le focuser ouvrirait le clavier du téléphone sans qu'on l'ait demandé. */
const saisie = (x: HTMLElement) => x.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]), textarea, select, [contenteditable="true"]');

export function useFeuille<T extends HTMLElement = HTMLDivElement>(
  onClose: () => void,
  opts: { verrou?: boolean; premier?: string } = {},
) {
  const ref = useRef<T>(null);
  const fermer = useRef(onClose);
  useEffect(() => {
    fermer.current = onClose;
  });
  const verrou = opts.verrou ?? false;
  const prefere = opts.premier;
  // Ce qui avait le focus avant la feuille, lu au premier rendu : un champ
  // autoFocus de la feuille l'a déjà pris quand les effets s'exécutent.
  const [origine] = useState(() => (typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const jeton = {};
    pile.push(jeton);
    const avant = origine;
    // Une entrée d'historique : le retour ferme la feuille au lieu de quitter l'écran.
    const entree = poserEntree(() => fermer.current());

    // Le focus entre dans la feuille : un élément marqué, sinon le premier
    // choix (pas la croix, pas un champ), sinon la feuille elle-même.
    if (!el.contains(document.activeElement)) {
      const marque = el.querySelector<HTMLElement>("[autofocus], [data-autofocus]") ?? (prefere ? el.querySelector<HTMLElement>(prefere) : null);
      const premier = visibles(el).find((x) => !x.classList.contains("x") && !saisie(x));
      const cible = marque ?? premier ?? el;
      if (cible === el && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      cible.focus({ preventScroll: true });
    }

    const onKey = (e: KeyboardEvent) => {
      if (pile[pile.length - 1] !== jeton) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        fermer.current();
        return;
      }
      if (e.key !== "Tab") return;
      // Tab est toujours géré ici : un champ caché ou un bouton qui disparaît ne fait jamais sortir le focus.
      e.preventDefault();
      const f = visibles(el);
      if (!f.length) {
        el.focus();
        return;
      }
      const i = f.indexOf(document.activeElement as HTMLElement);
      const j = i < 0 ? (e.shiftKey ? f.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + f.length) % f.length;
      f[j].focus();
    };
    document.addEventListener("keydown", onKey, true);

    // La page derrière ne défile pas tant que la feuille est ouverte.
    const overflow = document.body.style.overflow;
    if (verrou) document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey, true);
      retirerEntree(entree);
      const i = pile.indexOf(jeton);
      if (i >= 0) pile.splice(i, 1);
      if (verrou) document.body.style.overflow = overflow;
      const a = document.activeElement;
      const perdu = !a || a === document.body || !a.isConnected || el.contains(a);
      if (avant && avant.isConnected && perdu) avant.focus({ preventScroll: true });
    };
  }, [verrou, origine, prefere]);

  return ref;
}
