import type {
  HorsePnl,
  Period,
  StableData,
  Trend,
} from "@/lib/domain/types";
import { dateInPeriod, lastNPeriods, previousPeriod, samePeriod } from "@/lib/utils/period";
import {
  recurringDirectForHorse,
  recurringSharedForHorse,
  recurringRevenueForHorse,
  recurringSlices,
} from "@/lib/domain/recurring";

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
  return (
    sum(
      data.revenues
        .filter((r) => r.horseId === horseId && dateInPeriod(r.date, period))
        .map((r) => r.amount),
    ) + recurringRevenueForHorse(data, horseId, period)
  );
}

/** Direct expenses charged to one horse in one period. */
export function horseDirectCosts(
  data: StableData,
  horseId: string,
  period: Period,
): number {
  return (
    sum(
      data.directExpenses
        .filter((e) => e.horseId === horseId && dateInPeriod(e.date, period))
        .map((e) => e.amount),
    ) + recurringDirectForHorse(data, horseId, period)
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
  total += recurringSharedForHorse(data, horseId, period);
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

/** Aggregate the stable P&L across several periods (a range). */
export function aggregateStablePnl(data: StableData, periods: Period[]) {
  const parts = periods.map((p) => stablePnl(data, p));
  const revenue = round2(sum(parts.map((p) => p.revenue)));
  const directCosts = round2(sum(parts.map((p) => p.directCosts)));
  const sharedCosts = round2(sum(parts.map((p) => p.sharedCosts)));
  return {
    revenue,
    directCosts,
    sharedCosts,
    charges: round2(directCosts + sharedCosts),
    netResult: round2(revenue - directCosts - sharedCosts),
    netMarginPct: revenue === 0 ? 0 : round2(((revenue - directCosts - sharedCosts) / revenue) * 100),
    horseCount: data.horses.filter((h) => !h.isArchived).length,
    perMonth: periods.map((p, i) => ({ period: p, netResult: parts[i].netResult })),
  };
}

/** Aggregate one horse's net result across a range. */
export function aggregateHorseNet(
  data: StableData,
  horseId: string,
  periods: Period[],
): number {
  return round2(sum(periods.map((p) => horsePnl(data, horseId, p).netResult)));
}

export interface ExpenseSlice {
  label: string;
  amount: number;
  share: number; // 0..1 of total expenses
  kind: "direct" | "shared";
}

/**
 * Where the money goes: expenses grouped by category ("poste") across a range,
 * largest first. Combines direct and mutualised charges — the optimisation
 * targets are not only horses but cost posts.
 */
export function expenseBreakdown(data: StableData, periods: Period[]): ExpenseSlice[] {
  const inRange = (y: number, m: number) =>
    periods.some((p) => p.year === y && p.month === m);
  const catName = (id?: string) =>
    data.expenseCategories.find((c) => c.id === id)?.name;

  const map = new Map<string, { amount: number; kind: "direct" | "shared" }>();
  const add = (label: string, amount: number, kind: "direct" | "shared") => {
    const prev = map.get(label);
    map.set(label, { amount: (prev?.amount ?? 0) + amount, kind: prev?.kind ?? kind });
  };

  for (const e of data.directExpenses) {
    const d = e.date;
    const y = Number(d.slice(0, 4));
    const m = Number(d.slice(5, 7));
    if (!inRange(y, m)) continue;
    add(catName(e.categoryId) ?? e.label, e.amount, "direct");
  }
  for (const s of data.sharedExpenses) {
    if (!inRange(s.periodYear, s.periodMonth)) continue;
    add(catName(s.categoryId) ?? s.label, s.totalAmount, "shared");
  }
  // Recurring templates due in any of the periods.
  for (const p of periods) {
    for (const r of recurringSlices(data, p)) {
      add(catName(r.categoryId) ?? r.label, r.amount, r.kind);
    }
  }

  const slices = [...map.entries()].map(([label, v]) => ({
    label,
    amount: round2(v.amount),
    kind: v.kind,
  }));
  const total = sum(slices.map((s) => s.amount)) || 1;
  return slices
    .map((s) => ({ ...s, share: s.amount / total }))
    .sort((a, b) => b.amount - a.amount);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ExpenseMover {
  label: string;
  current: number;
  delta: number; // vs previous month (+ = costs more)
}

/**
 * What moved your margin this month: cost posts compared to the previous
 * month, biggest change first. The dynamic story behind the margin.
 */
export function expenseMovers(data: StableData, period: Period): ExpenseMover[] {
  const cur = expenseBreakdown(data, [period]);
  const old = expenseBreakdown(data, [previousPeriod(period)]);
  const oldMap = new Map(old.map((s) => [s.label, s.amount]));
  const seen = new Set<string>();
  const movers: ExpenseMover[] = [];
  for (const s of cur) {
    seen.add(s.label);
    movers.push({ label: s.label, current: s.amount, delta: round2(s.amount - (oldMap.get(s.label) ?? 0)) });
  }
  // Posts that vanished this month (a real saving).
  for (const s of old) {
    if (!seen.has(s.label)) movers.push({ label: s.label, current: 0, delta: round2(-s.amount) });
  }
  return movers.filter((m) => Math.abs(m.delta) >= 1).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export const _internal = { sum, round2, samePeriod };
