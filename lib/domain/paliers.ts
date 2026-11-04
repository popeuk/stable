import type { Period } from "./types";

/**
 * Les paliers de l'écurie (version interne du Clos, lib/fonctions.ts CLOS).
 *
 * Des objectifs qui se suivent dans le temps : chacun fixe le résultat du mois
 * à atteindre (ce qui reste une fois tout payé dans Mon bilan) jusqu'à son
 * dernier mois, et le nombre de pensions visées. Le gérant les pose lui-même
 * dans l'écran /paliers : ils vivent dans ses réglages, chiffrés avec le reste
 * de ses données. Aucun montant n'est écrit dans le code (le dépôt est public).
 * Domaine pur : ne lit ni magasin ni date.
 */
export interface Palier {
  nom: string;
  /** Le dernier mois du palier, AAAA-MM. */
  fin: string;
  /** Le résultat du mois à atteindre, en euros. */
  seuil: number;
  /** Les pensions payantes visées pendant ce palier. */
  pensions: number;
}

/** Aucun palier tant que le gérant ne les a pas posés. */
export const PALIERS_DEPART: Palier[] = [];

/** Le modèle proposé à la première saisie : quatre paliers vides. */
export const paliersVides = (): Palier[] => [1, 2, 3, 4].map((n) => ({ nom: `Palier ${n}`, fin: "", seuil: 0, pensions: 0 }));

/** Le premier mois suivi : septembre 2026. */
export const DEBUT_CLOS = "2026-09";

export const cleMois = (p: Period) => `${p.year}-${String(p.month).padStart(2, "0")}`;
export const versPeriode = (m: string): Period => ({ year: Number(m.slice(0, 4)), month: Number(m.slice(5, 7)) });

/** Les mois du suivi, du début au dernier mois du dernier palier. */
export function moisDuSuivi(paliers: Palier[], debut = DEBUT_CLOS): Period[] {
  if (!paliers.length) return [];
  const fin = paliers[paliers.length - 1].fin;
  const out: Period[] = [];
  let p = versPeriode(debut);
  for (let i = 0; i < 60 && cleMois(p) <= fin; i++) {
    out.push(p);
    p = p.month === 12 ? { year: p.year + 1, month: 1 } : { year: p.year, month: p.month + 1 };
  }
  return out;
}

/** Le palier visé ce mois-là : le premier dont le dernier mois n'est pas passé ; au-delà, le dernier. */
export function palierVise(paliers: Palier[], p: Period): number {
  if (!paliers.length) return -1;
  const m = cleMois(p);
  const i = paliers.findIndex((x) => m <= x.fin);
  return i < 0 ? paliers.length - 1 : i;
}

/** Le plus haut palier dont le seuil est atteint par ce résultat, ou -1. */
export function palierAtteint(paliers: Palier[], net: number): number {
  let atteint = -1;
  paliers.forEach((x, i) => {
    if (net >= x.seuil) atteint = i;
  });
  return atteint;
}

/** Ce qu'il manque au résultat pour atteindre le palier i (0 s'il est atteint). */
export function manquePour(paliers: Palier[], i: number, net: number): number {
  if (i < 0 || i >= paliers.length) return 0;
  return Math.max(0, Math.round(paliers[i].seuil - net));
}

/** Des paliers propres : quatre au plus, des mois qui se suivent, des montants et des pensions valables. */
export function paliersValables(paliers: Palier[]): boolean {
  if (!paliers.length || paliers.length > 6) return false;
  return paliers.every(
    (x, i) =>
      x.nom.trim().length > 0 &&
      /^\d{4}-(0[1-9]|1[0-2])$/.test(x.fin) &&
      Number.isFinite(x.seuil) &&
      Number.isFinite(x.pensions) &&
      x.pensions >= 0 &&
      (i === 0 || paliers[i - 1].fin <= x.fin),
  );
}
