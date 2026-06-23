import { describe, it, expect } from "vitest";
import {
  addMonths,
  daysInMonth,
  dateInPeriod,
  lastNPeriods,
  periodEnd,
  periodStart,
  previousPeriod,
} from "@/lib/utils/period";

describe("period helpers", () => {
  it("adds months across year boundaries", () => {
    expect(addMonths({ year: 2024, month: 12 }, 1)).toEqual({ year: 2025, month: 1 });
    expect(addMonths({ year: 2024, month: 1 }, -1)).toEqual({ year: 2023, month: 12 });
    expect(addMonths({ year: 2024, month: 6 }, -18)).toEqual({ year: 2022, month: 12 });
  });

  it("computes previous period", () => {
    expect(previousPeriod({ year: 2024, month: 1 })).toEqual({ year: 2023, month: 12 });
  });

  it("lists the last N periods oldest-first", () => {
    const periods = lastNPeriods({ year: 2024, month: 3 }, 3);
    expect(periods).toEqual([
      { year: 2024, month: 1 },
      { year: 2024, month: 2 },
      { year: 2024, month: 3 },
    ]);
  });

  it("knows days in a month (incl. leap year)", () => {
    expect(daysInMonth({ year: 2024, month: 2 })).toBe(29);
    expect(daysInMonth({ year: 2023, month: 2 })).toBe(28);
    expect(daysInMonth({ year: 2024, month: 4 })).toBe(30);
  });

  it("bounds a period correctly", () => {
    expect(periodStart({ year: 2024, month: 2 })).toBe("2024-02-01");
    expect(periodEnd({ year: 2024, month: 2 })).toBe("2024-02-29");
    expect(dateInPeriod("2024-02-15", { year: 2024, month: 2 })).toBe(true);
    expect(dateInPeriod("2024-03-01", { year: 2024, month: 2 })).toBe(false);
  });
});
