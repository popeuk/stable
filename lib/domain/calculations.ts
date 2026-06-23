import type {
  HorsePnl,
  Period,
  StableData,
  Trend,
} from "@/lib/domain/types";
import { dateInPeriod, lastNPeriods, samePeriod } from "@/lib/utils/period";

/**
 * Pure P&L calculations (section 10 of the spec). No I/O, no framework.
 * Everything here is unit tested in tests/unit/domain.
 */

function sum(ns: number[]): number {
  return ns.reduce((s, n) => s + n, 0);
}

/** Revenue booked for one horse in one period. */
export function horseRevenue(
  data: StableData,
  horseId: string,
  period: Period,
): number {
  return sum(
    data.revenues
      .filter((r) => r.horseId === horseId && dateInPeriod(r.date, period))
      .map((r) => r.amount),
  );
}

/** Direct expenses charged to one horse in one period. */
export function horseDirectCosts(
  data: StableData,
  horseId: string,
  period: Period,
): number {
  return sum(
    data.directExpenses
      .filter((e) => e.horseId === horseId && dateInPeriod(e.date, period))
      .map((e) => e.amount),
  );
}

/** Mutualised costs allocated to one horse for one period. */
export function horseSharedCosts(
  data: StableData,
  horseId: string,
  period: Period,
): number {
  let total = 0;
  for (const se of data.sharedExpenses) {
    if (se.periodYear !== period.year || se.periodMonth !== period.month) continue;
    for (const alloc of se.allocations) {
      if (alloc.horseId === horseId) total += alloc.allocatedAmount;
    }
  }
  return Math.round(total * 100) / 100;
}

/** Full P&L for one horse over one period (section 10.1–10.3). */
export function horsePnl(
  data: StableData,
  horseId: string,
  period: Period,
): HorsePnl {
  const revenue = horseRevenue(data, horseId, period);
  const directCosts = horseDirectCosts(data, horseId, period);
  const sharedCosts = horseSharedCosts(data, horseId, period);
  const netResult = round2(revenue - directCosts - sharedCosts);
  const threshold = round2(directCosts + sharedCosts);
  const grossMargin = round2(revenue - directCosts);
  const netMarginPct = revenue === 0 ? 0 : round2((netResult / revenue) * 100);

  return {
    horseId,
    revenue: round2(revenue),
    directCosts: round2(directCosts),
    sharedCosts,
    threshold,
    netResult,
    netMarginPct,
    grossMargin,
  };
}

/** Aggregate P&L across all active horses for one period. */
export function stablePnl(data: StableData, period: Period) {
  const active = data.horses.filter((h) => !h.isArchived);
  const perHorse = active.map((h) => horsePnl(data, h.id, period));
  return {
    revenue: round2(sum(perHorse.map((p) => p.revenue))),
    directCosts: round2(sum(perHorse.map((p) => p.directCosts))),
    sharedCosts: round2(sum(perHorse.map((p) => p.sharedCosts))),
    netResult: round2(sum(perHorse.map((p) => p.netResult))),
    horseCount: active.length,
    perHorse,
  };
}

/** Net result for one horse across the last N periods (oldest first). */
export function horseMarginSeries(
  data: StableData,
  horseId: string,
  endPeriod: Period,
  count = 12,
): number[] {
  return lastNPeriods(endPeriod, count).map(
    (p) => horsePnl(data, horseId, p).netResult,
  );
}

/** Stable-wide net result across the last N periods (oldest first). */
export function stableMarginSeries(
  data: StableData,
  endPeriod: Period,
  count = 12,
): number[] {
  return lastNPeriods(endPeriod, count).map(
    (p) => stablePnl(data, p).netResult,
  );
}

/**
 * Trend of a horse: compares the current month's net margin to the average
 * of the three preceding months (section 10.5).
 */
export function horseTrend(
  data: StableData,
  horseId: string,
  period: Period,
): Trend {
  const series = horseMarginSeries(data, horseId, period, 4); // N-3..N
  const current = series[series.length - 1];
  const prior = series.slice(0, 3);
  if (prior.length === 0) return "stable";
  const avg = prior.reduce((s, n) => s + n, 0) / prior.length;
  if (avg === 0) return current > 0 ? "hausse" : current < 0 ? "baisse" : "stable";
  if (current >= avg * 1.05) return "hausse";
  if (current <= avg * 0.95) return "baisse";
  return "stable";
}

/**
 * Volatility: population standard deviation of the last `count` months'
 * net results (section 10.6). Used by the insight engine and galaxy view.
 */
export function horseVolatility(
  data: StableData,
  horseId: string,
  period: Period,
  count = 6,
): number {
  const series = horseMarginSeries(data, horseId, period, count);
  const n = series.length;
  if (n === 0) return 0;
  const mean = series.reduce((s, v) => s + v, 0) / n;
  const variance =
    series.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  return round2(Math.sqrt(variance));
}

/** Did a horse cross from at/above its threshold to below it? */
export function crossedBelowThreshold(
  data: StableData,
  horseId: string,
  period: Period,
): boolean {
  const prevSeries = horseMarginSeries(data, horseId, period, 2);
  if (prevSeries.length < 2) return false;
  const prev = prevSeries[0];
  const cur = horsePnl(data, horseId, period);
  return prev >= 0 && cur.netResult < 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const _internal = { sum, round2, samePeriod };
