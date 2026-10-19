import { describe, expect, it } from "vitest";
import { jourDepense } from "@/lib/domain/presence";
import { ligneRemplie } from "@/lib/domain/corriger";
import { lignesComptables } from "@/lib/domain/comptable";
import type { SharedExpense, StableData } from "@/lib/domain/types";

/** Décision de Samuel (question 19, A) : une dépense de l'écurie est datée du jour où elle est notée. */
function data(se: Partial<SharedExpense>): StableData {
  return {
    horses: [],
    revenues: [],
    directExpenses: [],
    sharedExpenses: [{ id: "se1", stableId: "s", categoryId: "foin", label: "Foin", totalAmount: 300, periodMonth: 10, periodYear: 2026, distributionMode: "equal", source: "manual", allocations: [], ...se }],
    revenueCategories: [],
    expenseCategories: [{ id: "foin", name: "Foin", isDirect: false }],
  };
}

describe("le jour d'une dépense de l'écurie", () => {
  it("notée le 19 octobre : l'historique, Corriger et le comptable disent le 19", () => {
    const d = data({ date: "2026-10-19" });
    expect(jourDepense(d.sharedExpenses[0])).toBe("2026-10-19");
    expect(ligneRemplie(d, { t: "sh", id: "se1" })?.date).toBe("2026-10-19");
    expect(lignesComptables(d, 2026, "2026-12-31").find((l) => l.type === "Dépense")?.date).toBe("2026-10-19");
  });

  it("une dépense d'avant, sans jour noté, reste au 1er de son mois", () => {
    const d = data({});
    expect(jourDepense(d.sharedExpenses[0])).toBe("2026-10-01");
    expect(lignesComptables(d, 2026, "2026-12-31").find((l) => l.type === "Dépense")?.date).toBe("2026-10-01");
  });

  it("un jour qui ne tombe pas dans son mois ne la déplace pas", () => {
    expect(jourDepense({ date: "2026-09-30", periodYear: 2026, periodMonth: 10 })).toBe("2026-10-01");
  });

  it("le comptable ne reçoit pas une dépense notée pour un jour à venir", () => {
    const d = data({ date: "2026-10-25" });
    expect(lignesComptables(d, 2026, "2026-10-20").some((l) => l.type === "Dépense")).toBe(false);
  });
});
