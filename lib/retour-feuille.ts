/**
 * Le bouton retour d'Android ou du navigateur ferme d'abord la feuille
 * ouverte, au lieu de quitter l'écran.
 *
 * À l'ouverture d'une feuille, une entrée d'historique est posée par-dessus
 * l'écran (même adresse, une marque `bsFeuille` numérotée). Le retour la
 * retire : la feuille se ferme. Fermée autrement (la croix, le fond, un
 * choix), son entrée devient morte ; on ne la retire pas tout de suite (un
 * history.back() pendant une navigation la défairait). Elle est sautée au
 * prochain retour, et une navigation faite par-dessus la remplace au lieu de
 * s'empiler. Le retour nommé de l'en-tête (navigation.tsx) pousse l'écran
 * parent : il n'est pas touché.
 *
 * Au retour, on lit seulement l'entrée d'arrivée : les feuilles numérotées
 * au-dessus d'elle se ferment. On ne se fie pas à « l'entrée qu'on quitte » :
 * React rend le retour d'un coup et Next réécrit l'entrée d'arrivée avant
 * notre écouteur.
 */

const MARQUE = "bsFeuille";

let compteur = 0;
/** Les feuilles ouvertes dont l'entrée est posée : numéro de l'entrée → fermer. */
const ouvertes = new Map<number, () => void>();
/** Les entrées mortes encore dans l'historique (feuille fermée sans le retour). */
const mortes = new Set<number>();
/** Les entrées remplacées par un autre écran : elles ne sont plus dans l'historique. */
const remplacees = new Set<number>();
let installe = false;

const marqueDe = (s: unknown): number | null => {
  const v = s && typeof s === "object" ? (s as Record<string, unknown>)[MARQUE] : undefined;
  return typeof v === "number" ? v : null;
};
const chemin = (url: string | URL | null | undefined) => {
  if (url == null) return location.pathname + location.search;
  try {
    const u = new URL(String(url), location.href);
    return u.pathname + u.search;
  } catch {
    return null;
  }
};

function installer() {
  if (installe || typeof window === "undefined") return;
  installe = true;
  const push = history.pushState;
  const replace = history.replaceState;
  // Une navigation par-dessus une entrée de feuille la remplace : pas d'entrée morte en dessous.
  history.pushState = function (data: unknown, unused: string, url?: string | URL | null) {
    if (marqueDe(history.state) !== null && marqueDe(data) === null) {
      return history.replaceState(data, unused, url);
    }
    push.call(history, data, unused, url);
  };
  // Next réécrit l'entrée courante à chaque rendu du routeur : la marque reste, tant que l'adresse ne change pas.
  history.replaceState = function (data: unknown, unused: string, url?: string | URL | null) {
    const m = marqueDe(history.state);
    const garder = m !== null && marqueDe(data) === null && chemin(url) === location.pathname + location.search;
    const d = garder && (data === null || typeof data === "object") ? { ...((data as object) ?? {}), [MARQUE]: m } : data;
    replace.call(history, d, unused, url);
    // Une entrée morte remplacée par un autre écran n'est plus dans l'historique.
    if (m !== null && marqueDe(history.state) !== m) {
      mortes.delete(m);
      remplacees.add(m);
    }
  };
  window.addEventListener("popstate", (e) => {
    const arrivee = marqueDe(e.state) ?? 0;
    // Les feuilles ouvertes au-dessus de l'entrée d'arrivée : celle qu'on quitte (une seule d'habitude).
    const dessus = [...ouvertes.keys()].filter((n) => n > arrivee).sort((a, b) => b - a);
    if (dessus.length) {
      for (const n of dessus) {
        const fermer = ouvertes.get(n);
        ouvertes.delete(n);
        fermer?.();
      }
      return;
    }
    // On quitte une entrée morte (feuille déjà fermée) : le retour continue jusqu'à l'écran d'avant.
    const mortesDessus = [...mortes].filter((n) => n > arrivee);
    if (mortesDessus.length) {
      mortesDessus.forEach((n) => mortes.delete(n));
      history.back();
    }
  });
}

/** Pose l'entrée d'une feuille qui s'ouvre. Rend son numéro. */
export function poserEntree(fermer: () => void): number | null {
  if (typeof window === "undefined" || !window.history) return null;
  installer();
  // Plus haut que toute marque déjà dans l'historique (après un rechargement, le compte repart de zéro).
  compteur = Math.max(compteur, marqueDe(history.state) ?? 0) + 1;
  const n = compteur;
  const base = history.state && typeof history.state === "object" ? (history.state as object) : {};
  history.pushState({ ...base, [MARQUE]: n }, "");
  ouvertes.set(n, fermer);
  return n;
}

/** La feuille se ferme autrement que par le retour : son entrée devient morte. */
export function retirerEntree(n: number | null) {
  if (n !== null && ouvertes.delete(n) && !remplacees.has(n)) mortes.add(n);
}

/** Pour les tests. */
export function _etatRetour() {
  return { ouvertes: [...ouvertes.keys()], mortes: [...mortes] };
}
