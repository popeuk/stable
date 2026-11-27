import type { Period, StableData } from "@/lib/domain/types";
import { montantsDuMois, partDuMois, recurringDue } from "@/lib/domain/recurring";
import { r2 } from "@/lib/utils/arrondi";

/**
 * La TVA du mois (27 novembre 2026, reprise de l'app du Clos) : le chiffre
 * d'affaires TTC, la TVA collectée sur ce qui rentre, les frais TTC, la TVA
 * qu'ils contiennent, et la TVA à reverser (ou à récupérer). Chaque montant
 * est TVA comprise ; son taux vient de la recette (figé à sa création), de la
 * prestation de la séance, de la pension saisie, ou du frais, et à défaut de
 * sa catégorie (Pension, Cours, Foin…, réglée dans « Tes taux de TVA »). Un taux qui
 * manque n'est jamais deviné : son montant est compté à part, et l'écran le
 * dit. Domaine pur, testé.
 */

/** La TVA comprise dans un montant TTC au taux `taux` (en %). */
export const tvaDans = (ttc: number, taux: number) => (taux > 0 ? r2((ttc * taux) / (100 + taux)) : 0);

export interface TvaDuMois {
  caTTC: number;
  tvaCollectee: number;
  /** Ce qui rentre sans taux connu (sa TVA n'est pas comptée). */
  recettesSansTaux: number;
  fraisTTC: number;
  tvaDeductible: number;
  /** Les frais sans taux connu (leur TVA n'est pas déduite). */
  fraisSansTaux: number;
  /** Positif : à reverser ; négatif : à récupérer. */
  aReverser: number;
}

const valide = (t: unknown): t is number => typeof t === "number" && Number.isFinite(t) && t >= 0;

export function tvaDuMois(data: StableData, period: Period): TvaDuMois {
  const mk = `${period.year}-${String(period.month).padStart(2, "0")}`;
  const seances = new Map((data.seances ?? []).map((s) => [s.id, s]));
  const prestations = new Map((data.prestations ?? []).map((p) => [p.id, p]));
  const pensions = new Map((data.pensions ?? []).map((p) => [p.id, p]));
  const tauxRecette = new Map(data.revenueCategories.map((c) => [c.id, c.vatRate]));
  const tauxFrais = new Map(data.expenseCategories.map((c) => [c.id, c.vatRate]));
  const deCat = (m: Map<string, number | null | undefined>, id?: string) => (id ? (m.get(id) ?? undefined) : undefined);

  let caTTC = 0, tvaCollectee = 0, recettesSansTaux = 0;
  for (const r of data.revenues) {
    if (!r.date.startsWith(mk)) continue;
    const taux =
      r.vatRate ??
      (r.seanceId ? prestations.get(seances.get(r.seanceId)?.prestationId ?? "")?.vatRate : undefined) ??
      (r.pensionId ? pensions.get(r.pensionId)?.vatRate : undefined) ??
      deCat(tauxRecette, r.categoryId);
    caTTC += r.amount;
    if (valide(taux)) tvaCollectee += tvaDans(r.amount, taux);
    else recettesSansTaux += r.amount;
  }
  for (const rr of data.recurringRevenues ?? []) {
    if (!recurringDue(rr, period)) continue;
    caTTC += rr.amount;
    const taux = rr.vatRate ?? deCat(tauxRecette, rr.categoryId);
    if (valide(taux)) tvaCollectee += tvaDans(rr.amount, taux);
    else recettesSansTaux += rr.amount;
  }

  let fraisTTC = 0, tvaDeductible = 0, fraisSansTaux = 0;
  const frais = (montant: number, taux: number | null | undefined) => {
    if (montant <= 0) return;
    fraisTTC += montant;
    if (valide(taux)) tvaDeductible += tvaDans(montant, taux);
    else fraisSansTaux += montant;
  };
  for (const d of data.directExpenses) if (d.date.startsWith(mk)) frais(d.amount, d.vatRate ?? deCat(tauxFrais, d.categoryId));
  for (const se of data.sharedExpenses) {
    const m = se.dansEstimation ? partDuMois(se, period) : se.periodYear === period.year && se.periodMonth === period.month ? se.totalAmount : 0;
    frais(m, se.vatRate ?? deCat(tauxFrais, se.categoryId));
  }
  const duMois = montantsDuMois(data, period);
  for (const re of data.recurringExpenses ?? []) if (recurringDue(re, period)) frais(duMois.get(re.id) ?? re.amount, re.vatRate ?? deCat(tauxFrais, re.categoryId));

  return {
    caTTC: r2(caTTC),
    tvaCollectee: r2(tvaCollectee),
    recettesSansTaux: r2(recettesSansTaux),
    fraisTTC: r2(fraisTTC),
    tvaDeductible: r2(tvaDeductible),
    fraisSansTaux: r2(fraisSansTaux),
    aReverser: r2(tvaCollectee - tvaDeductible),
  };
}

/** Ce qui est noté dans le mois, catégorie par catégorie (TTC) : pour dire à côté de chaque taux ce qu'il touche. */
export function montantsParCategorie(data: StableData, period: Period): { recettes: Map<string, number>; frais: Map<string, number> } {
  const mk = `${period.year}-${String(period.month).padStart(2, "0")}`;
  const recettes = new Map<string, number>();
  const frais = new Map<string, number>();
  const plus = (m: Map<string, number>, id: string | undefined, v: number) => {
    if (!id || !(v > 0)) return;
    m.set(id, r2((m.get(id) ?? 0) + v));
  };
  for (const r of data.revenues) if (r.date.startsWith(mk)) plus(recettes, r.categoryId, r.amount);
  for (const rr of data.recurringRevenues ?? []) if (recurringDue(rr, period)) plus(recettes, rr.categoryId, rr.amount);
  for (const d of data.directExpenses) if (d.date.startsWith(mk)) plus(frais, d.categoryId, d.amount);
  for (const se of data.sharedExpenses) plus(frais, se.categoryId, se.dansEstimation ? partDuMois(se, period) : se.periodYear === period.year && se.periodMonth === period.month ? se.totalAmount : 0);
  const duMois = montantsDuMois(data, period);
  for (const re of data.recurringExpenses ?? []) if (recurringDue(re, period)) plus(frais, re.categoryId, duMois.get(re.id) ?? re.amount);
  return { recettes, frais };
}
