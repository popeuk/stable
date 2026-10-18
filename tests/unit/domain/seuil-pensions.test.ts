import { describe, expect, it } from "vitest";
import { monthBreakdown, seuilEtPlaces } from "@/lib/domain/ticket";
import type { Horse, StableData } from "@/lib/domain/types";

const oct = { year: 2026, month: 10 };

/** `pensions` chevaux à 350 €, `miens` chevaux du gérant, des frais de l'écurie de `frais` € par mois. */
function data(pensions: number, miens: number, frais: number): StableData {
  const horses: Horse[] = [
    ...Array.from({ length: pensions }, (_, i) => ({ id: `p${i}`, stableId: "s", name: `Cheval ${i + 1}`, ownerName: `Client ${i + 1}`, entryDate: "2026-01-01", isArchived: false })),
    ...Array.from({ length: miens }, (_, i) => ({ id: `m${i}`, stableId: "s", name: `Mon cheval ${i + 1}`, pensionType: "À moi", entryDate: "2026-01-01", isArchived: false })),
  ];
  return {
    horses,
    revenues: Array.from({ length: pensions }, (_, i) => ({ id: `r${i}`, stableId: "s", horseId: `p${i}`, amount: 350, date: "2026-10-01", source: "recurring" as const })),
    directExpenses: [{ id: "d", stableId: "s", horseId: "m0", label: "Maréchal", amount: 100, date: "2026-10-03", source: "manual" as const }].filter(() => miens > 0),
    sharedExpenses: [],
    revenueCategories: [],
    expenseCategories: [],
    recurringExpenses: [{ id: "f", stableId: "s", label: "Frais", amount: frais, isShared: true, frequency: "monthly", startDate: "2026-01-01", source: "manual" }],
  };
}

describe("combien de chevaux : on compte les pensions", () => {
  it("les chevaux du gérant ne sont pas des pensions", () => {
    const m = monthBreakdown(data(14, 2, 5330), oct);
    expect(m.pensions).toBe(14);
    expect(m.miens).toBe(2);
    // Une pension laisse 350 € ; elles doivent payer les frais et le maréchal du cheval du gérant.
    expect(m.contribution).toBe(350);
    expect(m.aCouvrir).toBe(5430);
    expect(Math.ceil(m.seuil)).toBe(16);
  });

  it("seuil au-delà des places : même pleines, il manque environ X € par mois", () => {
    const m = monthBreakdown(data(14, 2, 5800), oct);
    // 5 900 € à couvrir à 350 € la pension : 17 pensions, mais 16 places pour des pensions sur 18.
    const p = seuilEtPlaces(m, 18);
    expect(p).toEqual({ places: 18, placesPensions: 16, atteignable: false, manque: 300 });
  });

  it("assez de places : atteignable, rien ne manque", () => {
    const m = monthBreakdown(data(14, 2, 5330), oct);
    expect(seuilEtPlaces(m, 18)).toEqual({ places: 18, placesPensions: 16, atteignable: true, manque: 0 });
  });

  it("sans nombre de places, le seuil n'est pas borné", () => {
    const m = monthBreakdown(data(14, 0, 9000), oct);
    expect(seuilEtPlaces(m, 0).atteignable).toBe(true);
  });

  it("moins de places notées que de chevaux déjà là : on compte les chevaux", () => {
    // 14 pensions et 2 chevaux à soi pour « 11 places » : il y a au moins 16 places.
    const m = monthBreakdown(data(14, 2, 5800), oct);
    const p = seuilEtPlaces(m, 11);
    expect(p.places).toBe(16);
    expect(p.placesPensions).toBe(14);
  });
});
