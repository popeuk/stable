import type { Horse, Period, StableData } from "./types";
import type { Palier } from "./paliers";
import { cleMois, palierVise } from "./paliers";
import { monthBreakdown, estAuGerant } from "./ticket";
import { presentDans } from "./presence";
import { recurringRevenuesDue } from "./recurring";
import { seanceAmount } from "./seances";
import { addMonths } from "@/lib/utils/period";

/**
 * Le prévisionnel de Mon bilan (version du Clos) : le réel des mois passés,
 * le mois en cours (réel, plus ce qui reste prévu), et les douze mois qui
 * viennent, estimés avec ce que l'app sait déjà :
 * - les pensions des chevaux présents ce mois-là, à leur prix, changements
 *   programmés compris (sans les chevaux du gérant) ;
 * - les récurrentes des chevaux (une pension en modèle) ;
 * - les séances du planning, ou, quand le planning s'arrête, le rythme des
 *   derniers mois ;
 * - les frais : la moyenne des derniers mois complets.
 * Domaine pur : ne lit ni magasin ni date.
 */

export type EtatMois = "passe" | "encours" | "avenir";

export interface MoisBilan {
  cle: string;
  periode: Period;
  etat: EtatMois;
  /** Ce qui est vraiment resté (passé), ou déjà là (en cours) ; null sans chiffres ce mois-là. */
  reel: number | null;
  /** La fin du mois prévue (en cours) ou le mois estimé (à venir). */
  prevu: number | null;
  /** Le chiffre qui compte : le réel d'un mois passé, le prévu sinon. */
  valeur: number | null;
}

/** Les « Et si… » : des pensions et des cours particuliers en plus, dès le mois suivant. */
export interface Hypotheses {
  pensions: number;
  coursParSemaine: number;
  parPension: number;
  parCours: number;
}

export const SEMAINES_PAR_MOIS = 52 / 12;

const r0 = (n: number) => Math.round(n);

/** Un mois a des chiffres s'il y est rentré ou sorti de l'argent. */
function aDesChiffres(data: StableData, p: Period): { reste: number; charges: number; recettes: number } | null {
  const b = monthBreakdown(data, p);
  const charges = b.revenue - b.net;
  if (b.revenue <= 0 && charges <= 0) return null;
  return { reste: b.net, charges, recettes: b.revenue };
}

/** Le prix de pension d'un cheval pour un mois, changements programmés compris. */
export function pensionDuMois(h: Pick<Horse, "pension" | "pensionType" | "aVenir">, cle: string): { pension: number; formule?: string } {
  let pension = h.pension ?? 0;
  let formule = h.pensionType;
  for (const c of [...(h.aVenir ?? [])].sort((a, b) => a.depuis.localeCompare(b.depuis))) {
    if (c.depuis > cle) break;
    if (c.pensionType !== undefined) formule = c.pensionType || undefined;
    if (c.pension !== undefined) pension = c.pension;
  }
  return { pension, formule };
}

/** Les pensions attendues un mois : les chevaux présents, sans ceux du gérant. */
export function pensionsPrevues(data: StableData, p: Period): number {
  const cle = cleMois(p);
  let t = 0;
  for (const h of data.horses) {
    if (h.isArchived || !presentDans(h, p)) continue;
    const { pension, formule } = pensionDuMois(h, cle);
    if (estAuGerant({ pensionType: formule }) || !(pension > 0)) continue;
    t += pension;
    for (const rec of recurringRevenuesDue(data, h.id, p)) t += rec.amount;
  }
  return t;
}

/** Les séances prévues au planning ce mois-là, à leur prix. */
export function seancesPrevues(data: StableData, p: Period): number {
  const cle = cleMois(p);
  return (data.seances ?? []).filter((s) => s.status === "planned" && s.date.slice(0, 7) === cle).reduce((t, s) => t + seanceAmount(s), 0);
}

/** Les mois complets avant celui-ci qui ont des chiffres, du plus récent au plus ancien (n au plus). */
function derniersMois(data: StableData, now: Period, n: number) {
  const out: { charges: number; recettes: number; seances: number }[] = [];
  for (let k = 1; k <= 12 && out.length < n; k++) {
    const p = addMonths(now, -k);
    const c = aDesChiffres(data, p);
    if (!c) continue;
    const cle = cleMois(p);
    const seances = (data.seances ?? []).filter((s) => s.status === "done" && s.date.slice(0, 7) === cle).reduce((t, s) => t + seanceAmount(s), 0);
    out.push({ charges: c.charges, recettes: c.recettes, seances });
  }
  return out;
}

/** Les frais habituels et le rythme des séances : la moyenne des derniers mois complets (le mois en cours à défaut). */
export function habitudes(data: StableData, now: Period, n = 3): { charges: number; seances: number } {
  const mois = derniersMois(data, now, n);
  if (!mois.length) {
    const b = monthBreakdown(data, now);
    return { charges: Math.max(0, b.revenue - b.net), seances: 0 };
  }
  const moy = (f: (x: (typeof mois)[number]) => number) => mois.reduce((t, x) => t + f(x), 0) / mois.length;
  return { charges: moy((x) => x.charges), seances: moy((x) => x.seances) };
}

/** Un mois à venir, estimé. */
export function prevuDuMois(data: StableData, p: Period, h: { charges: number; seances: number }): number {
  const planning = seancesPrevues(data, p);
  return r0(pensionsPrevues(data, p) + (planning > 0 ? planning : h.seances) - h.charges);
}

/**
 * L'année de Mon bilan : `avant` mois passés, le mois en cours, `apres` mois à venir.
 * `resteDuMois` : ce qui est encore prévu d'ici la fin du mois en cours (séances, soins, tâches).
 */
export function anneeDuBilan(data: StableData, now: Period, resteDuMois: number, avant = 2, apres = 11): MoisBilan[] {
  const h = habitudes(data, now);
  const out: MoisBilan[] = [];
  for (let k = -avant; k <= apres; k++) {
    const p = addMonths(now, k);
    const cle = cleMois(p);
    if (k < 0) {
      const c = aDesChiffres(data, p);
      const reel = c ? r0(c.reste) : null;
      out.push({ cle, periode: p, etat: "passe", reel, prevu: null, valeur: reel });
    } else if (k === 0) {
      const reel = r0(monthBreakdown(data, p).net);
      const prevu = r0(reel + resteDuMois);
      out.push({ cle, periode: p, etat: "encours", reel, prevu, valeur: prevu });
    } else {
      const prevu = prevuDuMois(data, p, h);
      out.push({ cle, periode: p, etat: "avenir", reel: null, prevu, valeur: prevu });
    }
  }
  return out;
}

/** Ce que rapportent les « Et si » chaque mois. */
export const gainHypotheses = (h: Hypotheses) => r0(h.pensions * h.parPension + h.coursParSemaine * SEMAINES_PAR_MOIS * h.parCours);

/** L'année avec les « Et si » : chaque mois à venir gagne leur apport. */
export function avecHypotheses(mois: MoisBilan[], h: Hypotheses): MoisBilan[] {
  const g = gainHypotheses(h);
  if (!g) return mois;
  return mois.map((m) => (m.etat === "avenir" && m.prevu !== null ? { ...m, prevu: m.prevu + g, valeur: m.prevu + g } : m));
}

/** L'objectif d'un mois : le seuil du palier visé ce mois-là (null sans paliers). */
export function objectifDuMois(paliers: Palier[], p: Period): { i: number; seuil: number } | null {
  const i = palierVise(paliers, p);
  return i < 0 ? null : { i, seuil: paliers[i].seuil };
}

/** Un mois tient son objectif quand il le dépasse ; à zéro, quand il reste quelque chose. */
export const objectifTenu = (valeur: number, seuil: number) => (seuil > 0 ? valeur >= seuil : valeur > 0);

/**
 * L'avance prise : ce que les mois passés et le mois en cours (son réel) ont
 * laissé au-dessus de leur objectif, depuis le premier mois qui a des chiffres.
 */
export function avancePrise(mois: MoisBilan[], paliers: Palier[]): { montant: number; tenus: number; comptes: number; depuis: Period | null } {
  let montant = 0;
  let tenus = 0;
  let comptes = 0;
  let depuis: Period | null = null;
  for (const m of mois) {
    if (m.etat === "avenir" || m.reel === null) continue;
    const o = objectifDuMois(paliers, m.periode);
    if (!o) continue;
    depuis = depuis ?? m.periode;
    comptes++;
    montant += m.reel - o.seuil;
    if (objectifTenu(m.reel, o.seuil)) tenus++;
  }
  return { montant: r0(montant), tenus, comptes, depuis };
}

export type EtatPalier =
  | { etat: "tenu"; depuis: string }
  | { etat: "avance" | "heure" | "retard"; mois: string; ecart: number }
  | { etat: "loin"; meilleur: number; manque: number };

/**
 * Quand un palier passe, au rythme prévu : le premier mois qui atteint son
 * seuil, comparé à son dernier mois. Un palier atteint par le réel est tenu.
 */
export function etatPalier(mois: MoisBilan[], paliers: Palier[], i: number): EtatPalier {
  const p = paliers[i];
  // Tenu : un mois passé, ou ce qui est déjà là ce mois-ci, l'atteint.
  const tenu = mois.find((m) => m.etat !== "avenir" && m.reel !== null && objectifTenu(m.reel, p.seuil));
  if (tenu) return { etat: "tenu", depuis: tenu.cle };
  const prevuIdx = mois.findIndex((m) => m.etat !== "passe" && m.valeur !== null && objectifTenu(m.valeur, p.seuil));
  if (prevuIdx < 0) {
    const valeurs = mois.map((m) => m.valeur).filter((v): v is number => v !== null);
    const meilleur = valeurs.length ? Math.max(...valeurs) : 0;
    return { etat: "loin", meilleur, manque: Math.max(0, r0(p.seuil - meilleur)) };
  }
  const cle = mois[prevuIdx].cle;
  const ecart = moisEntre(cle, p.fin);
  return { etat: ecart > 0 ? "avance" : ecart === 0 ? "heure" : "retard", mois: cle, ecart: Math.abs(ecart) };
}

/** Le nombre de mois de a à b (positif si a est avant b). */
export function moisEntre(a: string, b: string): number {
  const n = (k: string) => Number(k.slice(0, 4)) * 12 + Number(k.slice(5, 7));
  return n(b) - n(a);
}
