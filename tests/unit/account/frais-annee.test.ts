import { describe, expect, it } from "vitest";

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: object }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};

const { useDataStore } = await import("@/stores/data-store");
const { fraisEnUnTotal, fraisDuMois, posteTape, FRAIS_CAT } = await import("@/components/bs/parcours");
const { parMois, saisiDe } = await import("@/lib/domain/montant-saisi");
const { POSTES_AJOUTES } = await import("@/lib/domain/postes-communs");
const { monthBreakdown } = await import("@/lib/domain/ticket");

const st = () => useDataStore.getState();
const juin = { year: 2026, month: 6 };

describe("les frais communs connus à l'année", () => {
  it("une écurie vide propose les nouveaux postes", () => {
    st().startEmpty();
    const noms = st().expenseCategories.filter((c) => !c.isDirect).map((c) => c.name);
    for (const n of POSTES_AJOUTES) expect(noms).toContain(n);
    expect(st().postesCommuns).toBe(1);
  });

  it("un total de 4 800 € par an compte 400 € chaque mois et se relit par an", () => {
    st().startEmpty();
    fraisEnUnTotal(parMois("an", 4800), juin, saisiDe("an", 4800));
    expect(fraisDuMois(st(), juin).total).toBe(400);
    expect(fraisDuMois(st(), { year: 2026, month: 11 }).total).toBe(400);
    const cat = st().expenseCategories.find((c) => c.name === FRAIS_CAT)!;
    expect(posteTape(st(), cat.id, juin)).toEqual({ mode: "an", montant: 4800, fois: 2 });
    // Repassé par mois : plus rien de « par an » à remontrer.
    fraisEnUnTotal(450, juin);
    expect(posteTape(st(), cat.id, juin)).toEqual({ mode: "mois", montant: 450, fois: 2 });
  });

  it("un foin en 2 fois 1 500 € pèse 250 € sur chaque mois, juin compris", () => {
    st().startEmpty();
    const hid = st().addHorse({ name: "Sirius", entryDate: "2026-01-01" });
    st().addRecurringRevenue({ horseId: hid, amount: 500, frequency: "monthly", startDate: "2026-01-01", endDate: null, source: "manual" });
    const foin = st().expenseCategories.find((c) => c.name === "Foin")!;
    st().setMonthlyCharge(foin.id, "Foin", parMois("fois", 1500, 2), { year: 2026, month: 1 }, saisiDe("fois", 1500, 2));
    for (const month of [1, 6, 12]) expect(monthBreakdown(st(), { year: 2026, month }).net).toBe(250);
    expect(posteTape(st(), foin.id, juin)).toEqual({ mode: "fois", montant: 1500, fois: 2 });
  });
});
