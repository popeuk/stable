import { OBSERVATOIRE } from "@/lib/observatoire-2026";

/**
 * Te choisir (26 novembre 2026) : où se place le prix d'une formule face aux
 * pensions de son département, d'après l'Observatoire Be Stable. On dit
 * toujours sur combien de prix la comparaison porte ; sous 10 prix relevés,
 * on ne compare pas.
 */

/** Sous ce nombre de prix relevés, la comparaison ne dit rien de sûr. */
export const MIN_RELEVES = 10;

export interface Secteur {
  code: string;
  nom: string;
  releves: number;
  mediane: number;
  bas: number;
  haut: number;
}

/** Le code du département d'un code postal français (Corse : 2A ou 2B, outre-mer : 971 à 976). */
export function departementDe(cp: string | undefined): string | null {
  const c = (cp ?? "").replace(/\s/g, "");
  if (!/^\d{5}$/.test(c)) return null;
  if (c.startsWith("97")) return c.slice(0, 3);
  if (c.startsWith("20")) return Number(c) < 20200 ? "2A" : "2B";
  return c.slice(0, 2);
}

/** Les prix du département, ou null si l'Observatoire n'en a pas. */
export function secteurDe(cp: string | undefined): Secteur | null {
  const code = departementDe(cp);
  const r = code ? OBSERVATOIRE[code] : undefined;
  if (!code || !r) return null;
  const [nom, releves, mediane, bas, haut] = r;
  return { code, nom, releves, mediane, bas, haut };
}

/** Un prix écrit par le gérant (« 450 », « 450 € », « 1 200 ») en euros, ou null. */
export function lirePrix(s: string | undefined): number | null {
  const m = (s ?? "").replace(/\s| | /g, "").match(/\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Math.round(Number(m[0].replace(",", ".")));
  return n > 0 ? n : null;
}

export type Place = "sous" | "dans" | "dessus";

/** Le prix face à la fourchette du département (la moitié des pensions y est). */
export function placeDe(prix: number, s: Secteur): Place {
  if (prix < s.bas) return "sous";
  if (prix > s.haut) return "dessus";
  return "dans";
}

export const MOTS_PLACE: Record<Place, string> = {
  sous: "Sous la plupart des pensions du département",
  dans: "Dans la moyenne du département",
  dessus: "Au-dessus de la plupart des pensions du département",
};

/** Position d'un prix sur l'axe dessiné (0 à 100 %), l'axe allant de la moitié du bas au double du haut, borné. */
export function surAxe(prix: number, s: Secteur): { min: number; max: number; pct: (v: number) => number } {
  const min = Math.max(0, Math.min(prix, s.bas) - 60);
  const max = Math.max(prix, s.haut) + 60;
  return { min, max, pct: (v: number) => Math.round(((v - min) / (max - min)) * 1000) / 10 };
}
