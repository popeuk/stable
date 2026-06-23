import type { ISODate, Period } from "@/lib/domain/types";

/** Pure period helpers. No framework dependencies — unit tested. */

export function currentPeriod(now = new Date()): Period {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function periodKey(p: Period): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

export function samePeriod(a: Period, b: Period): boolean {
  return a.year === b.year && a.month === b.month;
}

/** Returns the period `n` months before the given one (n may be negative). */
export function addMonths(p: Period, n: number): Period {
  const zeroBased = p.month - 1 + n;
  const year = p.year + Math.floor(zeroBased / 12);
  const month = ((zeroBased % 12) + 12) % 12;
  return { year, month: month + 1 };
}

export function previousPeriod(p: Period): Period {
  return addMonths(p, -1);
}

/** Last `count` periods ending at (and including) `end`, oldest first. */
export function lastNPeriods(end: Period, count: number): Period[] {
  const out: Period[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(addMonths(end, -i));
  return out;
}

export function daysInMonth(p: Period): number {
  return new Date(p.year, p.month, 0).getDate();
}

/** First day of the period as an ISO date (`YYYY-MM-01`). */
export function periodStart(p: Period): ISODate {
  return `${p.year}-${String(p.month).padStart(2, "0")}-01`;
}

/** Last day of the period as an ISO date. */
export function periodEnd(p: Period): ISODate {
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(
    daysInMonth(p),
  ).padStart(2, "0")}`;
}

/** Does an ISO date fall inside the given period? */
export function dateInPeriod(date: ISODate, p: Period): boolean {
  return date >= periodStart(p) && date <= periodEnd(p);
}

/** Selectable period ranges (section: dashboard period selector). */
export type RangePreset = "month" | "3m" | "ytd" | "last_year" | "12m";

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "month", label: "Ce mois" },
  { value: "3m", label: "3 mois" },
  { value: "ytd", label: "Cette année" },
  { value: "last_year", label: "An dernier" },
  { value: "12m", label: "12 mois" },
];

/** The list of months covered by a preset (oldest first). */
export function rangePeriods(
  active: Period,
  preset: RangePreset,
  now = currentPeriod(),
): Period[] {
  switch (preset) {
    case "month":
      return [active];
    case "3m":
      return lastNPeriods(now, 3);
    case "12m":
      return lastNPeriods(now, 12);
    case "ytd": {
      const out: Period[] = [];
      for (let m = 1; m <= now.month; m++) out.push({ year: now.year, month: m });
      return out;
    }
    case "last_year": {
      const out: Period[] = [];
      for (let m = 1; m <= 12; m++) out.push({ year: now.year - 1, month: m });
      return out;
    }
  }
}
