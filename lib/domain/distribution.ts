import type {
  DistributionMode,
  Horse,
  Period,
  SharedExpenseAllocation,
} from "@/lib/domain/types";
import { joursDansLeMois } from "@/lib/domain/sejours";
import { r2 } from "@/lib/utils/arrondi";

/**
 * Number of days a horse was present in the stable during a given month
 * (section 10.4 of the spec). Boundaries are inclusive on both ends. Un
 * cheval revenu après un départ additionne ses séjours du mois
 * (lib/domain/sejours).
 */
export function presenceDays(horse: Horse, p: Period): number {
  return joursDansLeMois(horse, p);
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
    amount: r2(r.amount),
  }));
  const sum = rounded.reduce((s, r) => s + r.amount, 0);
  const drift = r2((total - sum));
  if (drift !== 0 && rounded.length > 0) {
    let maxIdx = 0;
    for (let i = 1; i < rounded.length; i++) {
      if (rounded[i].amount > rounded[maxIdx].amount) maxIdx = i;
    }
    rounded[maxIdx].amount = r2((rounded[maxIdx].amount + drift));
  }

  return rounded.map((r) => ({
    horseId: r.horseId,
    allocatedAmount: r.amount,
    presenceDays: r.presenceDays,
  }));
}
