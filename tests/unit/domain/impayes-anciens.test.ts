import { describe, expect, it } from "vitest";
import { clientDues, duMois, impayesAnciens } from "@/lib/domain/clients";
import { repartirPaiement } from "@/lib/domain/paiement";
import type { StableData } from "@/lib/domain/types";

const nov = { year: 2026, month: 11 };

/** Hugo n'a pas payé septembre (120 € restants) ; octobre et novembre sont payés à moitié ou pas encore. */
function data(): StableData {
  return {
    horses: [{ id: "h1", stableId: "s", name: "Tonnerre", ownerName: "Hugo L.", entryDate: "2026-01-01", isArchived: false }],
    revenues: [
      { id: "s", stableId: "s", horseId: "h1", amount: 400, date: "2026-09-01", note: "Pension", source: "recurring" },
      { id: "o", stableId: "s", horseId: "h1", amount: 400, date: "2026-10-01", note: "Pension", source: "recurring" },
      { id: "n", stableId: "s", horseId: "h1", amount: 400, date: "2026-11-01", note: "Pension", source: "recurring" },
      { id: "e", stableId: "s", horseId: "", amount: 50, date: "2025-12-04", note: "Balade", payer: "Emma", source: "manual" },
    ],
    directExpenses: [],
    sharedExpenses: [],
    revenueCategories: [],
    expenseCategories: [],
    people: [{ id: "p", name: "Emma", role: "cavalier", active: true }],
    payments: [
      { id: "x1", payer: "Hugo L.", month: "2026-09", amount: 280, at: "" },
      { id: "x2", payer: "Hugo L.", month: "2026-10", amount: 400, at: "" },
    ],
  };
}

describe("Ils te doivent : tous les mois confondus", () => {
  it("l'impayé de septembre reste en novembre, avec son mois", () => {
    const hugo = clientDues(data(), nov).find((c) => c.name === "Hugo L.")!;
    expect(hugo.dueMois).toBe(400);
    expect(hugo.anciens).toEqual([{ month: "2026-09", due: 120 }]);
    expect(hugo.due).toBe(520);
  });

  it("un client qui ne doit plus que l'an dernier est dans la liste", () => {
    const emma = clientDues(data(), nov).find((c) => c.name === "Emma")!;
    expect(emma.dueMois).toBe(0);
    expect(emma.anciens).toEqual([{ month: "2025-12", due: 50 }]);
    expect(emma.due).toBe(50);
  });

  it("payé, l'ancien mois disparaît", () => {
    const d = data();
    d.payments!.push({ id: "x3", payer: "Hugo L.", month: "2026-09", amount: 120, at: "" });
    expect(impayesAnciens(d, nov).get("hugo l.")).toBeUndefined();
    expect(clientDues(d, nov).find((c) => c.name === "Hugo L.")!.due).toBe(400);
  });

  it("le mois se dit à côté de la somme", () => {
    expect(duMois("2026-09", nov)).toBe("de septembre");
    expect(duMois("2026-08", nov)).toBe("d’août");
    expect(duMois("2025-12", nov)).toBe("de décembre 2025");
  });

  it("« Un client m'a payé » depuis le + : tout payé, chaque mois est soldé, le plus ancien d'abord", () => {
    const d = data();
    const hugo = clientDues(d, nov).find((c) => c.name === "Hugo L.")!;
    const parts = repartirPaiement([...hugo.anciens, { month: "2026-11", due: hugo.dueMois }], hugo.due);
    expect(parts).toEqual([
      { month: "2026-09", amount: 120 },
      { month: "2026-11", amount: 400 },
    ]);
    parts.forEach((p, i) => d.payments!.push({ id: `y${i}`, payer: "Hugo L.", month: p.month, amount: p.amount, at: "" }));
    expect(clientDues(d, nov).find((c) => c.name === "Hugo L.")!.due).toBe(0);
  });
});
