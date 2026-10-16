import { describe, expect, it } from "vitest";
import { billTotals, billsFor, dueOf } from "@/lib/domain/billing";
import { clientDues } from "@/lib/domain/clients";
import { buildDemoData } from "@/lib/data/demo-data";
import type { StableData } from "@/lib/domain/types";

const oct = { year: 2026, month: 10 };
const base = (): StableData => ({
  horses: [
    { id: "h1", stableId: "s", name: "Tonnerre", entryDate: "2024-01-01", exitDate: null, isArchived: false, ownerName: "Hugo L." },
    { id: "h2", stableId: "s", name: "Cheval 1", entryDate: "2024-01-01", exitDate: null, isArchived: false },
    { id: "h3", stableId: "s", name: "Cheval 2", entryDate: "2024-01-01", exitDate: null, isArchived: false },
  ],
  revenues: [
    { id: "p1", stableId: "s", horseId: "h1", amount: 579, date: "2026-10-01", source: "recurring" },
    { id: "c1", stableId: "s", horseId: "h1", amount: 125, date: "2026-10-08", source: "manual", payer: "hugo l." },
    { id: "p2", stableId: "s", horseId: "h2", amount: 450, date: "2026-10-01", source: "recurring" },
    { id: "p3", stableId: "s", horseId: "h3", amount: 450, date: "2026-10-01", source: "recurring" },
  ],
  directExpenses: [],
  sharedExpenses: [],
  revenueCategories: [],
  expenseCategories: [],
  people: [{ id: "x", name: "Hugo L.", role: "proprietaire", active: true }],
  payments: [{ id: "pay", payer: "Hugo L.", month: "2026-10", amount: 579, at: "2026-10-05" }],
});

describe("Facturer et Clients donnent le même dû", () => {
  it("un même client, quelle que soit la casse, n'a qu'une note", () => {
    const bills = billsFor(base(), oct).filter((b) => !b.orphan);
    expect(bills).toHaveLength(1);
    expect(bills[0]).toMatchObject({ payer: "Hugo L.", total: 704, paid: 579, due: 125 });
    expect(clientDues(base(), oct).find((c) => c.name === "Hugo L.")?.due).toBe(125);
    expect(dueOf(base(), "hugo l.", oct)).toBe(125);
  });

  it("sur la démo, chaque client a le même dû dans les deux écrans", () => {
    const d = buildDemoData(new Date("2026-10-16T12:00:00"));
    const bills = billsFor(d, oct).filter((b) => !b.orphan);
    for (const c of clientDues(d, oct)) expect(c.due).toBe(bills.find((b) => b.payer === c.name)?.due ?? 0);
  });

  it("les chevaux sans propriétaire sont dits à part, pas comptés comme à recevoir (P2-4)", () => {
    const bills = billsFor(base(), oct);
    const t = billTotals(bills);
    expect(t.sansProprietaire).toBe(900);
    expect(t.total).toBe(704);
    expect(t.due).toBe(125);
    expect(bills.find((b) => b.orphan)?.due).toBe(0);
    // Écurie créée par le nombre de chevaux : rien à facturer à personne, et un total de 0.
    const nombre = { ...base(), horses: base().horses.slice(1), revenues: base().revenues.slice(2), payments: [] };
    expect(billTotals(billsFor(nombre, oct))).toMatchObject({ total: 0, due: 0, sansProprietaire: 900 });
  });
});
