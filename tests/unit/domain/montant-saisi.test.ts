import { describe, expect, it } from "vitest";
import { parAn, parMois, relire, saisiDe } from "@/lib/domain/montant-saisi";
import { ajouterPostesManquants, POSTES_AJOUTES } from "@/lib/domain/postes-communs";
import { stablePnl } from "@/lib/domain/calculations";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/data/demo-data";
import type { RecurringExpense, StableData } from "@/lib/domain/types";

describe("un frais connu par an ou en plusieurs fois", () => {
  it("par an : 3 000 € l'an font 250 € par mois", () => {
    expect(parMois("an", 3000)).toBe(250);
    expect(parAn("an", 3000)).toBe(3000);
  });
  it("en plusieurs fois : 2 fois 1 500 € font 3 000 € l'an, 250 € par mois", () => {
    expect(parAn("fois", 1500, 2)).toBe(3000);
    expect(parMois("fois", 1500, 2)).toBe(250);
    expect(parMois("fois", 300, 4)).toBe(100);
  });
  it("par mois : le montant ne bouge pas", () => {
    expect(parMois("mois", 400)).toBe(400);
    expect(parAn("mois", 400)).toBe(4800);
  });
  it("au centime, sans montant négatif", () => {
    expect(parMois("an", 1000)).toBe(83.33);
    expect(parMois("an", -50)).toBe(0);
  });
  it("garde le montant tapé seulement quand il n'est pas par mois", () => {
    expect(saisiDe("mois", 400)).toBeUndefined();
    expect(saisiDe("an", 0)).toBeUndefined();
    expect(saisiDe("an", 1200)).toEqual({ mode: "an", montant: 1200 });
    expect(saisiDe("fois", 1500, 2)).toEqual({ mode: "fois", montant: 1500, fois: 2 });
  });
  it("relit le montant tel qu'il a été tapé, ou par mois s'il a changé depuis", () => {
    expect(relire(250, { mode: "fois", montant: 1500, fois: 2 })).toEqual({ mode: "fois", montant: 1500, fois: 2 });
    expect(relire(300, { mode: "an", montant: 3000 })).toEqual({ mode: "mois", montant: 300, fois: 2 });
    expect(relire(120)).toEqual({ mode: "mois", montant: 120, fois: 2 });
  });
});

describe("ce qu'il te reste, mois par mois, avec un foin payé à l'année", () => {
  const base = (rec: Partial<RecurringExpense>): StableData => ({
    horses: [
      { id: "h1", stableId: "s", name: "A", entryDate: "2020-01-01", exitDate: null, isArchived: false },
      { id: "h2", stableId: "s", name: "B", entryDate: "2020-01-01", exitDate: null, isArchived: false },
    ],
    revenues: [],
    directExpenses: [],
    sharedExpenses: [],
    revenueCategories: [],
    expenseCategories: [],
    recurringRevenues: ["h1", "h2"].map((horseId) => ({ id: `p-${horseId}`, stableId: "s", horseId, amount: 500, frequency: "monthly" as const, startDate: "2026-01-01", endDate: null, source: "manual" as const })),
    recurringExpenses: [
      { id: "foin", stableId: "s", label: "Foin", amount: 0, isShared: true, distributionMode: "equal", frequency: "monthly", startDate: "2026-01-01", endDate: null, source: "manual", ...rec },
    ],
  });
  const mois = Array.from({ length: 12 }, (_, i) => ({ year: 2026, month: i + 1 }));

  it("2 fois 1 500 € : chaque mois, 1 000 € de pensions moins 250 € de foin, juin compris", () => {
    const data = base({ amount: parMois("fois", 1500, 2), saisi: saisiDe("fois", 1500, 2) });
    for (const p of mois) expect(stablePnl(data, p).netResult).toBe(750);
    expect(mois.reduce((t, p) => t + stablePnl(data, p).netResult, 0)).toBe(12 * 1000 - 3000);
  });

  it("3 000 € par an : la même chose, chaque cheval porte 125 € par mois", () => {
    const data = base({ amount: parMois("an", 3000), saisi: saisiDe("an", 3000) });
    expect(stablePnl(data, { year: 2026, month: 6 }).netResult).toBe(750);
    expect(stablePnl(data, { year: 2026, month: 6 }).perHorse.map((h) => h.sharedCosts)).toEqual([125, 125]);
  });

  it("enregistré en une fois en juin, il rendrait juin faux et les autres mois trop beaux (ce qu'on évite)", () => {
    const data = base({ amount: 3000, frequency: "yearly", startDate: "2026-06-01" });
    expect(stablePnl(data, { year: 2026, month: 6 }).netResult).toBe(-2000);
    expect(stablePnl(data, { year: 2026, month: 7 }).netResult).toBe(1000);
  });
});

describe("les postes qui manquaient", () => {
  it("une nouvelle écurie les a d'emblée, partagés entre les chevaux", () => {
    for (const name of POSTES_AJOUTES) {
      const c = DEFAULT_EXPENSE_CATEGORIES.find((x) => x.name === name);
      expect(c?.isDirect).toBe(false);
    }
    expect(new Set(DEFAULT_EXPENSE_CATEGORIES.map((c) => c.id)).size).toBe(DEFAULT_EXPENSE_CATEGORIES.length);
  });

  it("une écurie existante les reçoit sans rien perdre, une seule fois", () => {
    const old = [
      { id: "exp-s-0", name: "Foin", isDirect: false },
      { id: "exp-perso", name: "Ma catégorie", isDirect: false },
    ];
    const next = ajouterPostesManquants(old);
    expect(next.slice(0, 2)).toEqual(old);
    expect(next.slice(2).map((c) => c.name)).toEqual([...POSTES_AJOUTES]);
    expect(next.slice(2).every((c) => c.isDirect === false)).toBe(true);
    expect(ajouterPostesManquants(next)).toBe(next);
  });

  it("ne double pas un poste que le gérant avait déjà créé, et ne réutilise pas un identifiant pris", () => {
    const old = [
      { id: "exp-s-10", name: "Autre chose", isDirect: false },
      { id: "x", name: "remboursement d'emprunt", isDirect: false },
    ];
    const next = ajouterPostesManquants(old);
    expect(next.filter((c) => /emprunt/i.test(c.name))).toHaveLength(1);
    expect(new Set(next.map((c) => c.id)).size).toBe(next.length);
    expect(next).toHaveLength(5);
  });
});
