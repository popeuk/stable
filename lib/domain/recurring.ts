import type { Period, RecurringSchedule, StableData } from "@/lib/domain/types";
import { distribute } from "@/lib/domain/distribution";
import { periodEnd, periodStart } from "@/lib/utils/period";
import { chevauxPresents, partiAvant, presentDans } from "@/lib/domain/presence";

/** Un cheval qui n'était pas là ce mois (parti avant, entre deux séjours) ne reçoit pas ses récurrentes (pension, charge à lui). */
function encoreLa(data: StableData, horseId: string | undefined, period: Period): boolean {
  const h = horseId ? data.horses.find((x) => x.id === horseId) : undefined;
  return !h || presentDans(h, period) || !partiAvant(h, periodStart(period));
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
  let total = 0;
  for (const r of recurringList(data)) {
    if (!r.isShared || !recurringDue(r, period)) continue;
    const allocs = distribute(r.amount, active, r.distributionMode ?? "equal", period);
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
  return recurringList(data)
    .filter((r) => recurringDue(r, period) && (r.isShared || encoreLa(data, r.horseId, period)))
    .map((r) => ({
      label: r.label,
      categoryId: r.categoryId,
      amount: r.amount,
      kind: r.isShared ? ("shared" as const) : ("direct" as const),
    }));
}

/** Les charges récurrentes partagées dues ce mois (le total, avant répartition). */
export function recurringSharedTotal(data: StableData, period: Period): number {
  return recurringList(data)
    .filter((r) => r.isShared && recurringDue(r, period))
    .reduce((t, r) => t + r.amount, 0);
}
