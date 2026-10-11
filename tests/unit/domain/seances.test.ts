import { describe, expect, it } from "vitest";
import { seriesDates, seanceAmount, revenuesForSeance, seanceToValidate } from "@/lib/domain/seances";
import { billsFor } from "@/lib/domain/billing";
import type { Seance, StableData } from "@/lib/domain/types";

const base: Seance = {
  id: "s1", prestationId: "p", title: "Cours du soir", format: "collectif", places: 6,
  participants: [{ personId: "a", horseId: "h1" }, { personId: "b", horseId: "h2" }, { personId: "c" }],
  horseIds: ["h1", "h2"], date: "2026-10-10", start: "18:00", end: "19:00", status: "planned", unitPrice: 25, rev: 1,
};

describe("séries", () => {
  it("répète chaque semaine jusqu'à la date donnée", () => {
    expect(seriesDates("2026-10-06", "weekly", "2026-10-27")).toEqual(["2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27"]);
  });
  it("plafonne à 60 séances", () => {
    expect(seriesDates("2026-01-01", "weekly", "2030-01-01").length).toBeLessThanOrEqual(60);
  });
  it("ramène le 31 au dernier jour d'un mois court", () => {
    expect(seriesDates("2026-01-31", "monthly", "2026-03-31")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
});

describe("validation", () => {
  it("un présent = une prestation, au prix figé", () => {
    const done: Seance = { ...base, status: "done", participants: base.participants.map((p, i) => ({ ...p, present: i !== 2 })) };
    expect(seanceAmount(done)).toBe(50);
    const revs = revenuesForSeance(done, { people: [{ id: "a", name: "Emma", role: "cavalier", active: true }], revenueCategories: [] }, (() => { let n = 0; return () => `r${n++}`; })(), "st");
    expect(revs).toHaveLength(2);
    expect(revs[0]).toMatchObject({ horseId: "h1", amount: 25, payer: "Emma", seanceId: "s1" });
  });
  it("facture un absent quand la règle le dit", () => {
    const done: Seance = { ...base, status: "done", chargeAbsent: true, participants: base.participants.map((p, i) => ({ ...p, present: i !== 2 })) };
    expect(seanceAmount(done)).toBe(75);
  });
  it("est à valider une fois l'heure de fin passée", () => {
    expect(seanceToValidate(base, "2026-10-10", "18:30")).toBe(false);
    expect(seanceToValidate(base, "2026-10-10", "19:00")).toBe(true);
    expect(seanceToValidate(base, "2026-10-11", "08:00")).toBe(true);
  });
});

describe("à facturer", () => {
  it("regroupe par payeur, le propriétaire par défaut, moins les paiements", () => {
    const data = {
      horses: [{ id: "h1", stableId: "s", name: "Pacha", ownerName: "Julie", entryDate: "2026-01-01", isArchived: false }],
      revenues: [
        { id: "1", stableId: "s", horseId: "h1", amount: 490, date: "2026-10-01", source: "recurring" },
        { id: "2", stableId: "s", horseId: "h1", amount: 25, date: "2026-10-07", source: "manual", payer: "Emma" },
      ],
      directExpenses: [], sharedExpenses: [], revenueCategories: [], expenseCategories: [],
      payments: [{ id: "p", payer: "Julie", month: "2026-10", amount: 200, at: "" }],
    } as unknown as StableData;
    const bills = billsFor(data, { year: 2026, month: 10 });
    const julie = bills.find((b) => b.payer === "Julie")!;
    expect(julie.total).toBe(490);
    expect(julie.due).toBe(290);
    expect(bills.find((b) => b.payer === "Emma")!.role).toBe("cavalier");
  });
});
