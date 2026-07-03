import { describe, it, expect } from "vitest";
import { equilibrium } from "@/lib/domain/equilibrium";
import type { StableData } from "@/lib/domain/types";

function stable(partial: Partial<StableData>): StableData {
  return {
    horses: [
      { id: "h1", stableId: "s", name: "A", entryDate: "2020-01-01", exitDate: null, isArchived: false },
      { id: "h2", stableId: "s", name: "B", entryDate: "2020-01-01", exitDate: null, isArchived: false },
    ],
    revenues: [],
    directExpenses: [],
    sharedExpenses: [],
    revenueCategories: [],
    expenseCategories: [],
    ...partial,
  };
}

const JUNE = { year: 2024, month: 6 };

describe("equilibrium", () => {
  it("reports full coverage when revenue exceeds charges", () => {
    const data = stable({
      revenues: [
        { id: "r1", stableId: "s", horseId: "h1", amount: 500, date: "2024-06-05", source: "manual" },
        { id: "r2", stableId: "s", horseId: "h2", amount: 500, date: "2024-06-05", source: "manual" },
      ],
      directExpenses: [
        { id: "e1", stableId: "s", horseId: "h1", label: "Véto", amount: 400, date: "2024-06-10", source: "manual" },
      ],
    });
    const eq = equilibrium(data, [JUNE]);
    expect(eq.monthlyRevenue).toBe(1000);
    expect(eq.monthlyCharges).toBe(400);
    expect(eq.coverage).toBe(2.5);
    expect(eq.monthlyGap).toBe(0);
    expect(eq.missingPensionEquiv).toBe(0);
  });

  it("translates the gap into average pensions", () => {
    const data = stable({
      revenues: [
        // 2 horses at 450 → avg pension 450, revenue 900.
        { id: "r1", stableId: "s", horseId: "h1", amount: 450, date: "2024-06-05", source: "manual" },
        { id: "r2", stableId: "s", horseId: "h2", amount: 450, date: "2024-06-05", source: "manual" },
      ],
      directExpenses: [
        { id: "e1", stableId: "s", horseId: "h1", label: "Foin", amount: 1350, date: "2024-06-10", source: "manual" },
      ],
    });
    const eq = equilibrium(data, [JUNE]);
    expect(eq.monthlyGap).toBe(450);
    expect(eq.avgPension).toBe(450);
    // 450 missing ÷ 450 average pension = exactly 1 pension.
    expect(eq.missingPensionEquiv).toBe(1);
    expect(eq.coverage).toBeCloseTo(0.67, 2);
  });

  it("computes per-horse cost and margin", () => {
    const data = stable({
      revenues: [
        { id: "r1", stableId: "s", horseId: "h1", amount: 500, date: "2024-06-05", source: "manual" },
        { id: "r2", stableId: "s", horseId: "h2", amount: 500, date: "2024-06-05", source: "manual" },
      ],
      directExpenses: [
        { id: "e1", stableId: "s", horseId: "h1", label: "Foin", amount: 600, date: "2024-06-10", source: "manual" },
      ],
    });
    const eq = equilibrium(data, [JUNE]);
    expect(eq.costPerHorse).toBe(300);
    expect(eq.avgPension).toBe(500);
    expect(eq.marginPerHorse).toBe(200);
  });

  it("averages across a multi-month range", () => {
    const data = stable({
      revenues: [
        { id: "r1", stableId: "s", horseId: "h1", amount: 600, date: "2024-05-05", source: "manual" },
        { id: "r2", stableId: "s", horseId: "h1", amount: 400, date: "2024-06-05", source: "manual" },
      ],
      directExpenses: [
        { id: "e1", stableId: "s", horseId: "h1", label: "Foin", amount: 800, date: "2024-05-10", source: "manual" },
      ],
    });
    const eq = equilibrium(data, [{ year: 2024, month: 5 }, JUNE]);
    expect(eq.monthlyRevenue).toBe(500); // (600+400)/2
    expect(eq.monthlyCharges).toBe(400); // 800/2
    expect(eq.coverage).toBe(1.25);
  });

  it("stays safe with no data at all", () => {
    const eq = equilibrium(stable({ horses: [] }), [JUNE]);
    expect(eq.coverage).toBe(0);
    expect(eq.monthlyGap).toBe(0);
    expect(eq.missingPensionEquiv).toBe(0);
    expect(eq.costPerHorse).toBe(0);
  });
});
