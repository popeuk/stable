import { describe, it, expect } from "vitest";
import { stablePnl, outsideMoney, horsePnl } from "@/lib/domain/calculations";
import { horseTicket, monthBreakdown, reconciledNets } from "@/lib/domain/ticket";
import { billsFor } from "@/lib/domain/billing";
import type { StableData } from "@/lib/domain/types";

const period = { year: 2024, month: 2 };

function data(): StableData {
  return {
    horses: [
      { id: "h1", stableId: "s", name: "Belle", entryDate: "2020-01-01", exitDate: null, isArchived: false, ownerName: "Léa" },
      { id: "h2", stableId: "s", name: "Sirius", entryDate: "2020-01-01", exitDate: null, isArchived: false, ownerName: "Paul" },
    ],
    revenues: [
      { id: "r1", stableId: "s", horseId: "h1", amount: 600, date: "2024-02-05", source: "manual" },
      { id: "r2", stableId: "s", horseId: "h2", amount: 400, date: "2024-02-05", source: "manual" },
    ],
    directExpenses: [{ id: "d1", stableId: "s", horseId: "h1", label: "Véto", amount: 100, date: "2024-02-10", source: "manual" }],
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

const pac = { id: "pac", stableId: "s", horseId: "", amount: 4200, date: "2024-02-15", note: "PAC", source: "manual" as const };
const tracteur = { id: "tr", stableId: "s", horseId: "", label: "Réparation du tracteur", amount: 350, date: "2024-02-20", source: "manual" as const };

describe("argent hors chevaux", () => {
  it("une recette PAC compte dans le reste du mois et sur aucun ticket", () => {
    const d = data();
    const avant = monthBreakdown(d, period);
    d.revenues.push(pac);
    const m = monthBreakdown(d, period);
    expect(m.net).toBe(avant.net + 4200);
    expect(m.revenue).toBe(avant.revenue + 4200);
    expect(m.ins.find((l) => l.label === "PAC")?.amount).toBe(4200);
    // Aucun ticket ne bouge, la part commune non plus.
    for (const h of d.horses) {
      const t = horseTicket(d, h.id, period);
      expect(t.lines.some((l) => l.sourceId === "pac")).toBe(false);
      expect(t.net).toBe(horseTicket(data(), h.id, period).net);
      expect(horsePnl(d, h.id, period).sharedCosts).toBe(100);
    }
    // Ce que laisse un cheval en moyenne ne compte pas la PAC.
    expect(m.contribution).toBe(avant.contribution);
    // Personne ne doit la PAC.
    expect(billsFor(d, period).some((b) => b.lines.some((l) => l.label === "PAC"))).toBe(false);
  });

  it("une dépense tracteur compte dans le reste du mois et sur aucun ticket", () => {
    const d = data();
    const avant = monthBreakdown(d, period);
    d.directExpenses.push(tracteur);
    const m = monthBreakdown(d, period);
    expect(m.net).toBe(avant.net - 350);
    expect(m.outside).toBe(350);
    expect(m.direct).toBe(avant.direct);
    expect(m.sharedTotal).toBe(avant.sharedTotal);
    expect(m.outs).toEqual([{ label: "Réparation du tracteur", amount: 350 }]);
    for (const h of d.horses) {
      expect(horseTicket(d, h.id, period).lines.some((l) => l.sourceId === "tr")).toBe(false);
      expect(horseTicket(d, h.id, period).net).toBe(horseTicket(data(), h.id, period).net);
    }
  });

  it("le bilan de l'écurie reste cohérent et les tickets se réconcilient sans l'argent hors chevaux", () => {
    const d = data();
    d.revenues.push(pac);
    d.directExpenses.push(tracteur);
    const s = stablePnl(d, period);
    expect(outsideMoney(d, period)).toEqual({ revenue: 4200, costs: 350 });
    expect(s.horsesNet).toBe(700);
    expect(s.netResult).toBe(700 + 4200 - 350);
    expect(s.revenue - s.directCosts - s.sharedCosts).toBe(s.netResult);
    const nets = reconciledNets(d, period);
    expect(Object.values(nets).reduce((t, n) => t + n, 0)).toBe(700);
  });

  it("hors du mois, rien ne compte", () => {
    const d = data();
    d.revenues.push({ ...pac, date: "2024-03-01" });
    expect(stablePnl(d, period).outsideRevenue).toBe(0);
  });
});
