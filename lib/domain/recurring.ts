import type { Period, RecurringExpense, StableData } from "@/lib/domain/types";
import { distribute } from "@/lib/domain/distribution";
import { periodEnd, periodStart } from "@/lib/utils/period";

/** Is a recurring template due (and active) in a given month? */
export function recurringDue(rec: RecurringExpense, period: Period): boolean {
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

export function recurringList(data: StableData): RecurringExpense[] {
  return data.recurringExpenses ?? [];
}

/** Recurring direct charges due for one horse in a period. */
export function recurringDirectForHorse(
  data: StableData,
  horseId: string,
  period: Period,
): number {
  return recurringList(data)
    .filter((r) => !r.isShared && r.horseId === horseId && recurringDue(r, period))
    .reduce((s, r) => s + r.amount, 0);
}

/** Recurring shared charges allocated to one horse in a period. */
export function recurringSharedForHorse(
  data: StableData,
  horseId: string,
  period: Period,
): number {
  const active = data.horses.filter((h) => !h.isArchived);
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
    .filter((r) => recurringDue(r, period))
    .map((r) => ({
      label: r.label,
      categoryId: r.categoryId,
      amount: r.amount,
      kind: r.isShared ? ("shared" as const) : ("direct" as const),
    }));
}
