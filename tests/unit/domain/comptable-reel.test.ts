import { describe, expect, it } from "vitest";
import { lignesComptables } from "@/lib/domain/comptable";
import type { Invoice, StableData } from "@/lib/domain/types";

/** Tonnerre à Hugo, deux chevaux sans propriétaire, une estimation de foin et une vraie livraison. */
function data(invoices: Invoice[] = []): StableData {
  return {
    horses: [
      { id: "h1", stableId: "s", name: "Tonnerre", entryDate: "2026-01-01", isArchived: false, ownerName: "Hugo L." },
      { id: "h2", stableId: "s", name: "Cheval 1", entryDate: "2026-01-01", isArchived: false },
      { id: "h3", stableId: "s", name: "Cheval 2", entryDate: "2026-01-01", isArchived: false },
    ],
    revenues: [
      { id: "rev-pension-h1-2026-10", stableId: "s", horseId: "h1", categoryId: "cp", amount: 350, date: "2026-10-01", source: "recurring" },
      { id: "rev-pension-h2-2026-10", stableId: "s", horseId: "h2", categoryId: "cp", amount: 350, date: "2026-10-01", source: "recurring" },
      { id: "rev-pension-h3-2026-10", stableId: "s", horseId: "h3", categoryId: "cp", amount: 350, date: "2026-10-01", source: "recurring" },
      { id: "pac", stableId: "s", horseId: "", amount: 800, date: "2026-10-05", note: "PAC", source: "manual" },
      { id: "cours", stableId: "s", horseId: "h2", categoryId: "cc", amount: 25, date: "2026-10-06", payer: "Lou", source: "manual" },
    ],
    directExpenses: [{ id: "mar", stableId: "s", horseId: "h1", label: "Maréchal", amount: 60, date: "2026-10-04", source: "manual" }],
    sharedExpenses: [
      { id: "liv", stableId: "s", categoryId: "foin", label: "Foin", totalAmount: 120, periodMonth: 10, periodYear: 2026, distributionMode: "equal", source: "manual", allocations: [], dansEstimation: true },
    ],
    revenueCategories: [
      { id: "cp", name: "Pension" },
      { id: "cc", name: "Cours" },
    ],
    expenseCategories: [{ id: "foin", name: "Foin", isDirect: false }],
    recurringExpenses: [
      { id: "est", stableId: "s", label: "Foin", amount: 900, categoryId: "foin", isShared: true, distributionMode: "equal", frequency: "monthly", startDate: "2026-01-01", endDate: null, source: "manual" },
      { id: "pret", stableId: "s", label: "Remboursement d’emprunt", amount: 400, isShared: true, frequency: "monthly", startDate: "2026-01-01", endDate: null, source: "manual" },
    ],
    payments: [{ id: "x", payer: "Hugo L.", month: "2026-10", amount: 350, at: "2026-10-10T10:00:00", method: "virement" }],
    invoices,
  };
}

describe("le fichier du comptable : seulement le réel", () => {
  it("aucune estimation de frais : ni Mes frais, ni ce qui revient sans être noté", () => {
    const ls = lignesComptables(data(), 2026, "2026-10-31");
    const depenses = ls.filter((l) => l.type === "Dépense");
    expect(depenses.map((l) => l.montant).sort((a, b) => a - b)).toEqual([60, 120]);
    expect(ls.some((l) => l.montant === 900 || l.montant === 400)).toBe(false);
  });

  it("aucune pension de cheval sans propriétaire ni facture", () => {
    const recettes = lignesComptables(data(), 2026, "2026-10-31").filter((l) => l.type === "Recette");
    expect(recettes.map((l) => `${l.cheval}|${l.montant}`).sort()).toEqual(["Cheval 1|25", "Tonnerre|350", "|800"]);
  });

  it("une pension sur une facture reste, même sans propriétaire noté", () => {
    const inv = { id: "i", number: "2026-0001", kind: undefined, payer: "Marc", month: "2026-10", revenueIds: ["rev-pension-h3-2026-10"] } as unknown as Invoice;
    const recettes = lignesComptables(data([inv]), 2026, "2026-10-31").filter((l) => l.type === "Recette");
    expect(recettes.some((l) => l.cheval === "Cheval 2" && l.facture === "2026-0001")).toBe(true);
    expect(recettes.some((l) => l.cheval === "Cheval 1" && l.montant === 350)).toBe(false);
  });

  it("les paiements reçus y sont", () => {
    const enc = lignesComptables(data(), 2026, "2026-10-31").filter((l) => l.type === "Encaissement");
    expect(enc).toHaveLength(1);
    expect(enc[0].montant).toBe(350);
  });
});
