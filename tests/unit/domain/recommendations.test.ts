import { describe, it, expect } from "vitest";
import { generateRecommendations } from "@/lib/domain/recommendations";
import type { StableData } from "@/lib/domain/types";

const period = { year: 2024, month: 2 };

function data(): StableData {
  return {
    horses: [
      { id: "h1", stableId: "s", name: "Vaillant", entryDate: "2020-01-01", exitDate: null, isArchived: false },
    ],
    // Vaillant earns 400 but costs 300 direct + 200 shared = 500 → 100 under.
    revenues: [{ id: "r1", stableId: "s", horseId: "h1", amount: 400, date: "2024-02-05", source: "manual" }],
    directExpenses: [{ id: "d1", stableId: "s", horseId: "h1", label: "Véto", amount: 300, date: "2024-02-10", source: "manual" }],
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
        allocations: [{ horseId: "h1", allocatedAmount: 200 }],
      },
    ],
    revenueCategories: [],
    expenseCategories: [],
  };
}

describe("generateRecommendations", () => {
  it("recommends raising the pension of an under-threshold horse, quantified", () => {
    const recos = generateRecommendations(data(), period);
    const raise = recos.find((r) => r.type === "raise_pension");
    expect(raise).toBeTruthy();
    expect(raise!.relatedHorseId).toBe("h1");
    expect(raise!.expectedImpact).toBe(100); // the gap
    expect(raise!.scenarioHref).toContain("h1");
  });

  it("recommends trimming the biggest cost post", () => {
    const recos = generateRecommendations(data(), period);
    const cut = recos.find((r) => r.type === "cut_cost");
    expect(cut).toBeTruthy();
    // biggest post is Véto (300) → 10% = 30
    expect(cut!.costPost).toBe("Véto");
    expect(cut!.expectedImpact).toBe(30);
  });

  it("sorts by expected impact (largest first)", () => {
    const recos = generateRecommendations(data(), period);
    for (let i = 1; i < recos.length; i++) {
      expect(recos[i - 1].expectedImpact).toBeGreaterThanOrEqual(recos[i].expectedImpact);
    }
  });
});
