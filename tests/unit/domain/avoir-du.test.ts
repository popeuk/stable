import { describe, expect, it } from "vitest";
import { billOf, dueOf } from "@/lib/domain/billing";
import { clientDues } from "@/lib/domain/clients";
import { brouillon, contenuAvoir, emettre, emettreAvoir } from "@/lib/domain/facture";
import type { BillingInfo, StableData } from "@/lib/domain/types";

const oct = { year: 2026, month: 10 };
const B: BillingInfo = { legalName: "Les Pommiers", forme: "EI", vat: "franchise", address: "1 rue du Pré", siret: "12345678900012" };

/** Claire : la pension de Belle (350 €) et un cours (25 €), facturés le 20 octobre. */
function avecFacture() {
  const d: StableData = {
    horses: [{ id: "h1", stableId: "s", name: "Belle", entryDate: "2024-01-01", isArchived: false, ownerName: "Claire D." }],
    revenues: [
      { id: "p1", stableId: "s", horseId: "h1", categoryId: "cp", amount: 350, date: "2026-10-01", source: "recurring" },
      { id: "c1", stableId: "s", horseId: "h1", categoryId: "cc", amount: 25, date: "2026-10-08", source: "manual", payer: "Claire D.", seanceId: "s1" },
    ],
    directExpenses: [],
    sharedExpenses: [],
    revenueCategories: [
      { id: "cp", name: "Pension" },
      { id: "cc", name: "Cours" },
    ],
    expenseCategories: [],
    people: [{ id: "x", name: "Claire D.", role: "proprietaire", active: true, statut: "particulier" }],
    billing: B,
  };
  const inv = emettre(d, brouillon(d, "Claire D.", oct).facture!, "2026-10-20", "i1");
  return { d: { ...d, invoices: [inv], invoiceSeq: { "2026": 1 } } as StableData, inv };
}

describe("après un avoir, le client doit moins", () => {
  it("avoir total : elle ne doit plus rien, sa fiche montre l'avoir", () => {
    const { d, inv } = avecFacture();
    expect(dueOf(d, "Claire D.", oct)).toBe(375);
    const a = emettreAvoir(d, contenuAvoir(inv, inv.lines.map((l) => l.qty), d.invoices)!, "2026-10-21", "a1");
    const d2 = { ...d, invoices: [inv, a] };
    expect(dueOf(d2, "Claire D.", oct)).toBe(0);
    expect(billOf(d2, "Claire D.", oct)!.avoirs).toEqual([{ number: a.number, amount: 375 }]);
    expect(clientDues(d2, oct).find((c) => c.name === "Claire D.")!.due).toBe(0);
  });

  it("avoir partiel : ce qu'elle doit baisse d'autant", () => {
    const { d, inv } = avecFacture();
    const pension = inv.lines.findIndex((l) => l.kind === "pension");
    const a = emettreAvoir(d, contenuAvoir(inv, inv.lines.map((_, i) => (i === pension ? 1 : 0)), d.invoices)!, "2026-10-21", "a1");
    const d2 = { ...d, invoices: [inv, a] };
    expect(dueOf(d2, "Claire D.", oct)).toBe(25);
    expect(billOf(d2, "Claire D.", oct)!.avoirs).toEqual([{ number: a.number, amount: 350 }]);
  });

  it("avec un paiement déjà reçu, l'avoir s'ajoute au payé", () => {
    const { d, inv } = avecFacture();
    const pension = inv.lines.findIndex((l) => l.kind === "pension");
    const a = emettreAvoir(d, contenuAvoir(inv, inv.lines.map((_, i) => (i === pension ? 1 : 0)), d.invoices)!, "2026-10-21", "a1");
    const d2 = { ...d, invoices: [inv, a], payments: [{ id: "x", payer: "Claire D.", month: "2026-10", amount: 10, at: "" }] };
    expect(dueOf(d2, "Claire D.", oct)).toBe(15);
  });

  it("la ligne retirée puis annulée par l'avoir ne compte pas deux fois", () => {
    const { d, inv } = avecFacture();
    const pension = inv.lines.findIndex((l) => l.kind === "pension");
    const a = emettreAvoir(d, contenuAvoir(inv, inv.lines.map((_, i) => (i === pension ? 1 : 0)), d.invoices)!, "2026-10-21", "a1");
    const d2 = { ...d, revenues: d.revenues.filter((r) => r.id !== "p1"), invoices: [inv, a] };
    expect(dueOf(d2, "Claire D.", oct)).toBe(25);
  });

  it("la recette remise sur une nouvelle facture est due de nouveau", () => {
    const { d, inv } = avecFacture();
    const a = emettreAvoir(d, contenuAvoir(inv, inv.lines.map((l) => l.qty), d.invoices)!, "2026-10-21", "a1");
    const d2 = { ...d, invoices: [inv, a], invoiceSeq: { "2026": 2 } } as StableData;
    const inv2 = emettre(d2, brouillon(d2, "Claire D.", oct).facture!, "2026-10-22", "i2");
    const d3 = { ...d2, invoices: [inv, a, inv2] };
    expect(dueOf(d3, "Claire D.", oct)).toBe(375);
  });
});
