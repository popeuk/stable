/**
 * Les erreurs d'écran (app/(app)/error.tsx, app/global-error.tsx, la limite
 * de la coque). Un écran qui plante n'abîme pas les données : on ne propose
 * jamais d'effacer ici. Seul cas traité à part : un morceau de code introuvable
 * juste après une mise en ligne (l'app ouverte garde l'ancienne version en
 * mémoire). Là, on recharge une fois tout seul, avec un garde-fou pour ne
 * jamais boucler.
 */

/** Le morceau de code demandé n'existe plus sur le site (mise en ligne entre-temps). */
export function estChargementRate(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: unknown; message?: unknown };
  const nom = typeof e.name === "string" ? e.name : "";
  const msg = typeof e.message === "string" ? e.message : "";
  if (nom === "ChunkLoadError") return true;
  return /Loading (CSS )?chunk [^ ]+ failed|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(msg);
}

export const CLE_RECHARGE = "be-stable-recharge-auto";
/** Un seul rechargement automatique par fenêtre de 60 secondes. */
export const FENETRE_RECHARGE_MS = 60_000;

type Rangement = Pick<Storage, "getItem" | "setItem">;

/**
 * Faut-il recharger tout seul ? Oui la première fois ; non si on vient déjà de
 * le faire (moins d'une minute) : l'écran d'erreur s'affiche alors normalement.
 * Pose la marque quand la réponse est oui.
 */
export function rechargerUneFois(error: unknown, rangement: Rangement | null | undefined, maintenant = Date.now()): boolean {
  if (!estChargementRate(error) || !rangement) return false;
  try {
    const avant = Number(rangement.getItem(CLE_RECHARGE) ?? 0);
    if (avant && maintenant - avant < FENETRE_RECHARGE_MS) return false;
    rangement.setItem(CLE_RECHARGE, String(maintenant));
    return true;
  } catch {
    return false;
  }
}

/** Le sessionStorage du navigateur, s'il est là et utilisable. */
export function rangementSession(): Rangement | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}
