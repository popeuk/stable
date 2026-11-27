import type { Category, ISODate, PensionContrat, Revenue, StableData } from "@/lib/domain/types";
import { moisEntre, moisDit } from "@/lib/domain/autopilot";
import { liensDuCheval } from "@/lib/domain/liens";
import { r2 } from "@/lib/utils/arrondi";

/**
 * Les pensions saisies à la main (27 novembre 2026, repris de l'app du
 * Clos) : un cheval, qui la paie, un prix par mois TTC, un taux de TVA, une
 * période. Chaque mois où elle court, une recette est postée toute seule
 * (comme l'autopilote des pensions du cheval), avec le nom du payeur et son
 * taux de TVA. Le premier et le dernier mois se comptent au prorata des
 * jours. Plusieurs pensions peuvent porter sur le même cheval.
 * Domaine pur, testé.
 */

/** L'identifiant déterministe de la recette d'une pension pour un mois : l'idempotence. */
export function pensionContratRevenueId(pensionId: string, monthKey: string): string {
  return `rev-pc-${pensionId}-${monthKey}`;
}

const finDuMois = (monthKey: string) => {
  const y = Number(monthKey.slice(0, 4));
  const m = Number(monthKey.slice(5, 7));
  return `${monthKey}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

/** La pension court-elle ce mois-ci (AAAA-MM) ? */
export function pensionCourt(p: Pick<PensionContrat, "startDate" | "endDate">, monthKey: string): boolean {
  return p.startDate <= finDuMois(monthKey) && (p.endDate == null || p.endDate >= `${monthKey}-01`);
}

/** Les pensions qui courent ce mois-ci. */
export function pensionsDuMois(data: Pick<StableData, "pensions">, monthKey: string): PensionContrat[] {
  return (data.pensions ?? []).filter((p) => p.amount > 0 && pensionCourt(p, monthKey));
}

/** Les chevaux qui ont une pension saisie : leur Horse.pension ne se poste plus (autopilot.ts). */
export function chevauxAvecContrat(data: Pick<StableData, "pensions">): Set<string> {
  return new Set((data.pensions ?? []).map((p) => p.horseId));
}

/**
 * Le montant d'une pension pour un mois : entier, ou au prorata des jours
 * entre son premier et son dernier jour compté dans le mois, avec sa note.
 * `jusqua` arrête le mois en cours à aujourd'hui.
 */
export function montantDuMois(p: Pick<PensionContrat, "amount" | "startDate" | "endDate">, monthKey: string): { amount: number; debut: ISODate; note?: string } | null {
  const premier = `${monthKey}-01`;
  const dernier = finDuMois(monthKey);
  const debut = p.startDate > premier ? p.startDate : premier;
  const fin = p.endDate && p.endDate < dernier ? p.endDate : dernier;
  if (debut > fin) return null;
  const jours = Number(dernier.slice(8, 10));
  const n = Number(fin.slice(8, 10)) - Number(debut.slice(8, 10)) + 1;
  if (n >= jours) return { amount: p.amount, debut };
  const y = Number(monthKey.slice(0, 4));
  const m = Number(monthKey.slice(5, 7));
  const j = (d: string) => (Number(d.slice(8, 10)) === 1 ? "1er" : String(Number(d.slice(8, 10))));
  return { amount: r2((p.amount * n) / jours), debut, note: `Pension du ${j(debut)} au ${j(fin)} ${moisDit(y, m)}` };
}

/** Qui paie : la personne de la pension, sinon le propriétaire du cheval. */
export function payeurDe(p: PensionContrat, data: Pick<StableData, "horses" | "people" | "horseLinks">): string | undefined {
  if (p.personId) return (data.people ?? []).find((x) => x.id === p.personId)?.name;
  const proprio = liensDuCheval(data, p.horseId).find((l) => l.role === "proprietaire");
  return proprio ? (data.people ?? []).find((x) => x.id === proprio.personId)?.name : data.horses.find((h) => h.id === p.horseId)?.ownerName;
}

/**
 * Les recettes de pension manquantes, de `depuis` (AAAA-MM) au mois en cours.
 * Une pension déjà postée pour un mois ne l'est pas deux fois ; une ligne
 * supprimée par le gérant (dismissed) ne revient pas. Le mois de la
 * bascule, si le cheval a déjà une recette de pension sans contrat ce mois-là
 * (postée par l'ancien autopilote ou à la main) et une seule pension saisie,
 * on ne double pas.
 */
export function ensurePensionsContrats(
  data: Pick<StableData, "horses" | "people" | "horseLinks" | "pensions" | "revenues"> & { revenueCategories: Category[] },
  today: ISODate,
  dismissed: string[] = [],
  depuis?: string,
): Revenue[] {
  const contrats = (data.pensions ?? []).filter((p) => p.amount > 0);
  if (!contrats.length) return [];
  const cat = data.revenueCategories.find((c) => c.name.toLowerCase() === "pension");
  if (!cat) return [];
  const skip = new Set(dismissed);
  const postees = new Set(data.revenues.filter((r) => r.pensionId).map((r) => `${r.pensionId}|${r.date.slice(0, 7)}`));
  const anciennes = new Set(data.revenues.filter((r) => r.categoryId === cat.id && !r.pensionId).map((r) => `${r.horseId}|${r.date.slice(0, 7)}`));
  const parCheval = new Map<string, number>();
  for (const p of contrats) parCheval.set(p.horseId, (parCheval.get(p.horseId) ?? 0) + 1);

  const out: Revenue[] = [];
  for (const mk of moisEntre(depuis, today.slice(0, 7))) {
    for (const p of contrats) {
      if (!pensionCourt(p, mk) || (mk === today.slice(0, 7) && p.startDate > today)) continue;
      if (postees.has(`${p.id}|${mk}`)) continue;
      if (parCheval.get(p.horseId) === 1 && anciennes.has(`${p.horseId}|${mk}`)) continue;
      const rid = pensionContratRevenueId(p.id, mk);
      if (skip.has(rid)) continue;
      const m = montantDuMois(p, mk);
      if (!m || m.amount <= 0) continue;
      const payer = payeurDe(p, data);
      out.push({
        id: rid,
        stableId: data.horses.find((h) => h.id === p.horseId)?.stableId ?? "",
        horseId: p.horseId,
        categoryId: cat.id,
        amount: m.amount,
        date: m.debut,
        ...(m.note ? { note: m.note } : p.label ? { note: p.label } : {}),
        source: "recurring",
        ...(payer ? { payer } : {}),
        pensionId: p.id,
        ...(p.vatRate != null ? { vatRate: p.vatRate } : {}),
      });
    }
  }
  return out;
}
