import type { Period, StableData } from "@/lib/domain/types";
import { aggregateStablePnl } from "@/lib/domain/calculations";

/**
 * The stable's break-even, translated into the owner's own units. The most
 * pedagogical number in the app: not an abstract margin percentage but "your
 * charges are covered at N %" and "the gap is worth X pensions". Pure and
 * unit-tested like the rest of the domain.
 */
export interface Equilibrium {
  /** Average monthly charges over the range. */
  monthlyCharges: number;
  /** Average monthly revenue over the range. */
  monthlyRevenue: number;
  /** revenue / charges. 1 = break-even reached. 0 when nothing is booked. */
  coverage: number;
  /** €/month still missing to cover the charges (0 when covered). */
  monthlyGap: number;
  /** Average monthly revenue per active horse — "one pension" in practice. */
  avgPension: number;
  /** The gap expressed in average pensions (1 decimal, 0 when unknown). */
  missingPensionEquiv: number;
  /** Average monthly charges per active horse. */
  costPerHorse: number;
  /** avgPension − costPerHorse: what one occupied place leaves you. */
  marginPerHorse: number;
  horseCount: number;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function equilibrium(data: StableData, periods: Period[]): Equilibrium {
  const agg = aggregateStablePnl(data, periods);
  const months = Math.max(1, periods.length);
  const monthlyCharges = r2(agg.charges / months);
  const monthlyRevenue = r2(agg.revenue / months);
  const horseCount = agg.horseCount;

  const coverage =
    monthlyCharges > 0
      ? r2(monthlyRevenue / monthlyCharges)
      : monthlyRevenue > 0
        ? 1
        : 0;
  const monthlyGap = r2(Math.max(0, monthlyCharges - monthlyRevenue));
  const avgPension = horseCount > 0 ? r2(monthlyRevenue / horseCount) : 0;
  const missingPensionEquiv =
    avgPension > 0 ? Math.round((monthlyGap / avgPension) * 10) / 10 : 0;
  const costPerHorse = horseCount > 0 ? r2(monthlyCharges / horseCount) : 0;
  const marginPerHorse = r2(avgPension - costPerHorse);

  return {
    monthlyCharges,
    monthlyRevenue,
    coverage,
    monthlyGap,
    avgPension,
    missingPensionEquiv,
    costPerHorse,
    marginPerHorse,
    horseCount,
  };
}
