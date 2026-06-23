import { describe, it, expect } from "vitest";
import { generateRecommendations } from "@/lib/domain/recommendations";
import type { StableData } from "@/lib/domain/types";

const period = { year: 2024, month: 2 };

function data(): StableData {
  return {
    horses: [
      { id: "h1", stableId: "s", name: "Vaillant", entryDate: "2020-01-01", exitDate: null, isArchived: false },
    ],
    revenues: [
      { id: "r1", stableId: "s", horseId: "h1", categoryId: "cp", amount: 400, date: "2024-02-05", source: "manual" },
    ],
    directExpenses: [
      { id: "d1", stableId: "s", horseId: "h1", label: "Véto", amount: 300, date: "2024-02-10", source: "manual" },
    ],
    sharedExpenses: [
      {
        id: "se1",
        stableId: "s",
        categoryId: "cf",
        label: "Foin",
        totalAmount: 200,
        periodMonth: 2,
        periodYear: 2024,
        distributionMode: "equal",
        source: "manual",
        allocations: [{ horseId: "h1", allocatedAmount: 200 }],
      },
    ],
    revenueCategories: [{ id: "cp", name: "Pension" }],
    expenseCategories: [{ id: "cf", name: "Foin", isDirect: false }],
  };
}

describe("generateRecommendations — commercially realistic", () => {
  it("leads with filling empty stalls when below capacity (growth lever)", () => {
    const recos = generateRecommendations(data(), period, 4); // 1 horse, 4 places
    const fill = recos.find((r) => r.type === "fill_capacity");
    expect(fill).toBeTruthy();
    // 3 empty places × 400 avg pension = 1200 potential
    expect(fill!.expectedImpact).toBe(1200);
    expect(fill!.impactKind).toBe("potentiel");
    // it should be the top recommendation
    expect(recos[0].type).toBe("fill_capacity");
  });

  it("renegotiates a negotiable supply cost, never salaries", () => {
    const recos = generateRecommendations(data(), period, 4);
    const neg = recos.find((r) => r.type === "negotiate_cost");
    expect(neg!.costPost).toBe("Foin"); // negotiable
    expect(neg!.expectedImpact).toBe(16); // 8% of 200
  });

  it("never recommends an abrupt single-horse pension hike", () => {
    const recos = generateRecommendations(data(), period, 4);
    // No reco type proposes raising one client's pension on the spot.
    expect(recos.every((r) => r.type !== ("raise_pension" as never))).toBe(true);
    // The under-priced horse is flagged softly, to realign at renewal.
    const soft = recos.find((r) => r.type === "reprice_underpriced");
    expect(soft).toBeTruthy();
    expect(soft!.why).toMatch(/renouvellement|prestation|prochain cheval/);
  });

  it("indexes pensions gently and across the board (3%)", () => {
    const recos = generateRecommendations(data(), period, 4);
    const idx = recos.find((r) => r.type === "index_pensions");
    expect(idx!.expectedImpact).toBe(12); // 3% of 400 revenue
  });

  it("does not push capacity advice when the stable is full", () => {
    const recos = generateRecommendations(data(), period, 1); // full
    expect(recos.find((r) => r.type === "fill_capacity")).toBeUndefined();
  });
});
