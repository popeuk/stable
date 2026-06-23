import type {
  DistributionMode,
  Horse,
  Period,
  SharedExpenseAllocation,
} from "@/lib/domain/types";
import { daysInMonth, periodEnd, periodStart } from "@/lib/utils/period";

/**
 * Number of days a horse was present in the stable during a given month
 * (section 10.4 of the spec). Boundaries are inclusive on both ends.
 */
export function presenceDays(horse: Horse, p: Period): number {
  const monthStart = periodStart(p);
  const monthEnd = periodEnd(p);
  const total = daysInMonth(p);

  const entered = horse.entryDate;
  const exited = horse.exitDate ?? null;

  // Present for the whole month.
  if (entered <= monthStart && (exited === null || exited >= monthEnd)) {
    return total;
  }

  const from = entered > monthStart ? entered : monthStart;
  const to = exited !== null && exited < monthEnd ? exited : monthEnd;

  if (to < from) return 0;

  // +1 because both endpoints are inclusive.
  const ms = Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z");
  return Math.max(0, Math.round(ms / 86_400_000) + 1);
}

/**
 * Split a total amount across horses for a period.
 *
 * "equal"             → total / n
 * "weighted_by_days"  → proportional to presence days that month
 *
 * The result is rounded to the cent and the rounding remainder is pushed
 * onto the largest allocation so the parts always sum back to the total.
 */
export function distribute(
  total: number,
  horses: Horse[],
  mode: DistributionMode,
  period: Period,
): SharedExpenseAllocation[] {
  if (horses.length === 0) return [];

  let raw: { horseId: string; amount: number; presenceDays?: number }[];

  if (mode === "equal") {
    const share = total / horses.length;
    raw = horses.map((h) => ({ horseId: h.id, amount: share }));
  } else {
    const days = horses.map((h) => presenceDays(h, period));
    const totalDays = days.reduce((s, d) => s + d, 0);
    if (totalDays === 0) {
      // Nobody present — fall back to an equal split to avoid /0.
      const share = total / horses.length;
      raw = horses.map((h) => ({ horseId: h.id, amount: share }));
    } else {
      raw = horses.map((h, i) => ({
        horseId: h.id,
        amount: (days[i] / totalDays) * total,
        presenceDays: days[i],
      }));
    }
  }

  // Round to cents, then reconcile the remainder onto the biggest share.
  const rounded = raw.map((r) => ({
    ...r,
    amount: Math.round(r.amount * 100) / 100,
  }));
  const sum = rounded.reduce((s, r) => s + r.amount, 0);
  const drift = Math.round((total - sum) * 100) / 100;
  if (drift !== 0 && rounded.length > 0) {
    let maxIdx = 0;
    for (let i = 1; i < rounded.length; i++) {
      if (rounded[i].amount > rounded[maxIdx].amount) maxIdx = i;
    }
    rounded[maxIdx].amount = Math.round((rounded[maxIdx].amount + drift) * 100) / 100;
  }

  return rounded.map((r) => ({
    horseId: r.horseId,
    allocatedAmount: r.amount,
    presenceDays: r.presenceDays,
  }));
}
