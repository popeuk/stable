import type { Period, RecurringSchedule, StableData } from "@/lib/domain/types";
import { distribute } from "@/lib/domain/distribution";
import { periodEnd, periodStart } from "@/lib/utils/period";
import { chevauxPresents, recurrenteDuCheval } from "@/lib/domain/presence";

/** Un cheval qui n'était pas là ce mois (parti avant, entre deux séjours) ne reçoit pas ses récurrentes (pension, charge à lui). */
function encoreLa(data: StableData, horseId: string | undefined, period: Period): boolean {
  const h = horseId ? data.horses.find((x) => x.id === horseId) : undefined;
  return !h || recurrenteDuCheval(h, period);
}

/** Is a recurring template due (and active) in a given month? */
export function recurringDue(rec: RecurringSchedule, period: Period): boolean {
  const ps = periodStart(period);
  const pe = periodEnd(period);
  if (rec.startDate > pe) return false; // not started yet
  if (rec.endDate && rec.endDate < ps) return false; // already ended

  const sy = Number(rec.startDate.slice(0, 4));
  const sm = Number(rec.startDate.slice(5, 7));
  const months = (period.year - sy) * 12 + (period.month - sm);
  if (months < 0) return false;

  switch (rec.frequency) {
    case "monthly":
      return true;
    case "quarterly":
      return months % 3 === 0;
    case "yearly":
      return months % 12 === 0;
  }
}

export function recurringList(data: StableData) {
  return data.recurringExpenses ?? [];
}

/**
 * Ce que chaque frais de l'écurie qui revient compte vraiment un mois donné.
 * Un frais de « Mes frais » est une estimation (foin : 900 € par mois). Une
 * vraie dépense du même poste notée « c'est dedans » (`dansEstimation`) en
 * fait partie : elle est décomptée de l'estimation du mois, jamais en dessous
 * de zéro. Le mois compte 900 € en tout (120 € réels, 780 € estimés), pas
 * 1 020 €. Rend le montant du mois de chaque frais, par son id.
 */
export function montantsDuMois(data: StableData, period: Period): Map<string, number> {
  const dedans = new Map<string, number>();
  for (const se of data.sharedExpenses) {
    if (!se.dansEstimation || !se.categoryId || se.periodYear !== period.year || se.periodMonth !== period.month) continue;
    dedans.set(se.categoryId, (dedans.get(se.categoryId) ?? 0) + se.totalAmount);
  }
  const out = new Map<string, number>();
  for (const r of recurringList(data)) {
    let a = r.amount;
    const reste = r.isShared && r.categoryId ? dedans.get(r.categoryId) ?? 0 : 0;
    if (reste > 0 && recurringDue(r, period)) {
      const pris = Math.min(a, reste);
      a = Math.round((a - pris) * 100) / 100;
      dedans.set(r.categoryId!, Math.round((reste - pris) * 100) / 100);
    }
    out.set(r.id, a);
  }
  return out;
}

/** L'estimation d'un poste de l'écurie pour un mois (ce qui revient chaque mois dans cette catégorie), avant toute vraie dépense. */
export function estimationDuPoste(data: Pick<StableData, "recurringExpenses">, categoryId: string | undefined, period: Period): number {
  if (!categoryId) return 0;
  const t = (data.recurringExpenses ?? []).filter((r) => r.isShared && r.categoryId === categoryId && recurringDue(r, period)).reduce((s, r) => s + r.amount, 0);
  return Math.round(t * 100) / 100;
}

/** Les recettes récurrentes d'un cheval dues ce mois, s'il est encore là. */
export function recurringRevenuesDue(data: StableData, horseId: string, period: Period) {
  return (data.recurringRevenues ?? []).filter((r) => r.horseId === horseId && recurringDue(r, period) && encoreLa(data, horseId, period));
}

/** Recurring revenues (e.g. pensions) due for one horse in a period. */
export function recurringRevenueForHorse(
  data: StableData,
  horseId: string,
  period: Period,
): number {
  return recurringRevenuesDue(data, horseId, period).reduce((s, r) => s + r.amount, 0);
}

/** Les charges récurrentes directes d'un cheval dues ce mois, s'il est encore là. */
export function recurringDirectDue(data: StableData, horseId: string, period: Period) {
  return recurringList(data).filter((r) => !r.isShared && r.horseId === horseId && recurringDue(r, period) && encoreLa(data, horseId, period));
}

/** Recurring direct charges due for one horse in a period. */
export function recurringDirectForHorse(
  data: StableData,
  horseId: string,
  period: Period,
): number {
  return recurringList(data)
    .filter((r) => !r.isShared && r.horseId === horseId && recurringDue(r, period) && encoreLa(data, horseId, period))
    .reduce((s, r) => s + r.amount, 0);
}

/** Recurring shared charges allocated to one horse in a period. */
export function recurringSharedForHorse(
  data: StableData,
  horseId: string,
  period: Period,
): number {
  // Partagées entre les chevaux présents ce mois-là : le passé ne bouge pas quand un cheval part ou arrive.
  const active = chevauxPresents(data, period);
  const du = montantsDuMois(data, period);
  let total = 0;
  for (const r of recurringList(data)) {
    if (!r.isShared || !recurringDue(r, period)) continue;
    const allocs = distribute(du.get(r.id) ?? r.amount, active, r.distributionMode ?? "equal", period);
    const mine = allocs.find((a) => a.horseId === horseId);
    if (mine) total += mine.allocatedAmount;
  }
  return Math.round(total * 100) / 100;
}

/** Recurring charges due in a period, as breakdown-ready slices. */
export function recurringSlices(
  data: StableData,
  period: Period,
): { label: string; categoryId?: string; amount: number; kind: "direct" | "shared" }[] {
  const du = montantsDuMois(data, period);
  return recurringList(data)
    .filter((r) => recurringDue(r, period) && (r.isShared || encoreLa(data, r.horseId, period)))
    .map((r) => ({
      label: r.label,
      categoryId: r.categoryId,
      amount: du.get(r.id) ?? r.amount,
      kind: r.isShared ? ("shared" as const) : ("direct" as const),
    }));
}

/** Les charges récurrentes partagées dues ce mois (le total, avant répartition). */
export function recurringSharedTotal(data: StableData, period: Period): number {
  const du = montantsDuMois(data, period);
  return recurringList(data)
    .filter((r) => r.isShared && recurringDue(r, period))
    .reduce((t, r) => t + (du.get(r.id) ?? r.amount), 0);
}
