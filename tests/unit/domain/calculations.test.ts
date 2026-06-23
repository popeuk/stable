import { describe, it, expect } from "vitest";
import {
  horsePnl,
  horseTrend,
  horseVolatility,
  stablePnl,
} from "@/lib/domain/calculations";
import type { StableData } from "@/lib/domain/types";

const period = { year: 2024, month: 2 };

function baseData(): StableData {
  return {
    horses: [
      { id: "h1", stableId: "s", name: "Belle", entryDate: "2020-01-01", exitDate: null, isArchived: false },
      { id: "h2", stableId: "s", name: "Sirius", entryDate: "2020-01-01", exitDate: null, isArchived: false },
    ],
    revenues: [
      { id: "r1", stableId: "s", horseId: "h1", amount: 600, date: "2024-02-05", source: "manual" },
      { id: "r2", stableId: "s", horseId: "h2", amount: 400, date: "2024-02-05", source: "manual" },
    ],
    directExpenses: [
      { id: "d1", stableId: "s", horseId: "h1", label: "Véto", amount: 100, date: "2024-02-10", source: "manual" },
    ],
    sharedExpenses: [
      {
        id: "se1",
        stableId: "s",
        label: "Foin",
        totalAmount: 200,
        periodMonth: 2,
        periodYear: 2024,
        distributionMode: "equal",
        source: "manual",
        allocations: [
          { horseId: "h1", allocatedAmount: 100 },
          { horseId: "h2", allocatedAmount: 100 },
        ],
      },
    ],
    revenueCategories: [],
    expenseCategories: [],
  };
}

describe("horsePnl", () => {
  it("computes net result, threshold and margin", () => {
    const p = horsePnl(baseData(), "h1", period);
    expect(p.revenue).toBe(600);
    expect(p.directCosts).toBe(100);
    expect(p.sharedCosts).toBe(100);
    expect(p.threshold).toBe(200);
    expect(p.netResult).toBe(400);
    expect(p.grossMargin).toBe(500);
    expect(p.netMarginPct).toBeCloseTo(66.67, 1);
  });

  it("returns 0% margin when there is no revenue", () => {
    const data = baseData();
    data.revenues = [];
    const p = horsePnl(data, "h1", period);
    expect(p.revenue).toBe(0);
    expect(p.netMarginPct).toBe(0);
    expect(p.netResult).toBe(-200);
  });

  it("ignores transactions outside the period", () => {
    const data = baseData();
    data.revenues.push({ id: "rx", stableId: "s", horseId: "h1", amount: 999, date: "2024-03-01", source: "manual" });
    expect(horsePnl(data, "h1", period).revenue).toBe(600);
  });
});

describe("stablePnl", () => {
  it("aggregates across active horses", () => {
    const s = stablePnl(baseData(), period);
    expect(s.revenue).toBe(1000);
    expect(s.directCosts).toBe(100);
    expect(s.sharedCosts).toBe(200);
    expect(s.netResult).toBe(700);
    expect(s.horseCount).toBe(2);
  });

  it("excludes archived horses", () => {
    const data = baseData();
    data.horses[1].isArchived = true;
    const s = stablePnl(data, period);
    expect(s.horseCount).toBe(1);
    expect(s.revenue).toBe(600);
  });
});

describe("trend & volatility", () => {
  it("flags a rising trend", () => {
    // Build 4 months: low, low, low then a high current month.
    const data = baseData();
    data.revenues = [];
    data.directExpenses = [];
    data.sharedExpenses = [];
    const months = [
      { d: "2023-11-15", amt: 100 },
      { d: "2023-12-15", amt: 100 },
      { d: "2024-01-15", amt: 100 },
      { d: "2024-02-15", amt: 500 },
    ];
    months.forEach((m, i) =>
      data.revenues.push({ id: `r${i}`, stableId: "s", horseId: "h1", amount: m.amt, date: m.d, source: "manual" }),
    );
    expect(horseTrend(data, "h1", period)).toBe("hausse");
    expect(horseVolatility(data, "h1", period, 4)).toBeGreaterThan(0);
  });
});
