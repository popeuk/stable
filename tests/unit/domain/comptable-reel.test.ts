import { describe, expect, it } from "vitest";
import { lignesComptables } from "@/lib/domain/comptable";
import type { Invoice, StableData } from "@/lib/domain/types";
import { brouillon, contenuAvoir, emettre, emettreAvoir } from "@/lib/domain/facture";

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

describe("le fichier du comptable : ce qui revient chaque mois, noté pour de vrai", () => {
  const avecRecurrentes = (): StableData => ({
    ...data(),
    recurringExpenses: [
      ...(data().recurringExpenses ?? []),
      // Le + sur Tonnerre : « Complément 40 € tous les mois », depuis le 15 août.
      { id: "comp", stableId: "s", label: "Complément", amount: 40, isShared: false, horseId: "h1", frequency: "monthly", startDate: "2026-08-15", endDate: null, source: "manual" },
    ],
    recurringRevenues: [
      // Le + en recette sur Tonnerre (à Hugo) et sur Cheval 1 (sans propriétaire).
      { id: "trav", stableId: "s", horseId: "h1", label: "Travail", amount: 80, frequency: "monthly", startDate: "2026-09-01", source: "manual" },
      { id: "orph", stableId: "s", horseId: "h2", label: "Travail", amount: 80, frequency: "monthly", startDate: "2026-09-01", source: "manual" },
    ],
  });

  it("le frais d'un cheval « tous les mois » : chaque mois passé et le mois en cours, rien d’après", () => {
    const ls = lignesComptables(avecRecurrentes(), 2026, "2026-10-10").filter((l) => l.libelle === "Complément");
    expect(ls.map((l) => l.date)).toEqual(["2026-08-15", "2026-09-15", "2026-10-10"]);
    expect(ls.every((l) => l.type === "Dépense" && l.cheval === "Tonnerre" && l.montant === 40)).toBe(true);
  });

  it("la recette « tous les mois » d'un cheval qui a un propriétaire y va, à son client ; sans propriétaire, non", () => {
    const ls = lignesComptables(avecRecurrentes(), 2026, "2026-10-31").filter((l) => l.libelle === "Travail");
    expect(ls.map((l) => `${l.date}|${l.cheval}|${l.client}|${l.montant}`)).toEqual(["2026-09-01|Tonnerre|Hugo L.|80", "2026-10-01|Tonnerre|Hugo L.|80"]);
  });

  it("les estimations de Mes frais n'y vont toujours pas", () => {
    const ls = lignesComptables(avecRecurrentes(), 2026, "2026-10-31");
    expect(ls.some((l) => l.montant === 900 || l.montant === 400)).toBe(false);
  });

  it("l'année d'avant : ses douze mois", () => {
    const d = avecRecurrentes();
    d.recurringExpenses = [{ id: "c", stableId: "s", label: "Complément", amount: 40, isShared: false, horseId: "h1", frequency: "monthly", startDate: "2025-01-01", endDate: null, source: "manual" }];
    expect(lignesComptables(d, 2025, "2026-10-31").filter((l) => l.libelle === "Complément")).toHaveLength(12);
  });
});

describe("le fichier du comptable et les avoirs : une seule fois", () => {
  const B = { legalName: "Les Pommiers", forme: "EI" as const, vat: "franchise" as const, address: "1 rue du Pré", siret: "12345678900012" };
  /** Marc paie la pension de Cheval 2, sans propriétaire noté ; facturée puis annulée. */
  function annulee() {
    const d0 = data();
    const d: StableData = {
      ...d0,
      revenues: d0.revenues.map((r) => (r.id === "rev-pension-h3-2026-10" ? { ...r, payer: "Marc" } : r)),
      people: [{ id: "m", name: "Marc", role: "proprietaire", active: true, statut: "particulier", address: "3 allée des Saules", nomComplet: "Marc Durand" }],
      billing: B,
    };
    const inv = emettre(d, brouillon(d, "Marc", { year: 2026, month: 10 }).facture!, "2026-10-20", "i1");
    const d1 = { ...d, invoices: [inv], invoiceSeq: { "2026": 1 } };
    const a = emettreAvoir(d1, contenuAvoir(inv, inv.lines.map((l) => l.qty), d1.invoices)!, "2026-10-21", "a1");
    return { d: { ...d1, invoices: [inv, a] } as StableData, inv, a };
  }

  it("la vente annulée garde sa recette et son numéro, l'avoir est une ligne négative", () => {
    const { d, inv, a } = annulee();
    const ls = lignesComptables(d, 2026, "2026-10-31");
    const marc = ls.filter((l) => l.client === "Marc");
    expect(marc.map((l) => `${l.type}|${l.montant}|${l.facture}`)).toEqual([`Recette|350|${inv.number}`, `Avoir|-350|${a.number}`]);
  });

  it("une recette facturée puis retirée de l'app reste telle que facturée : l'avoir ne la retire pas deux fois", () => {
    const { d, inv } = annulee();
    const d2 = { ...d, revenues: d.revenues.filter((r) => r.id !== "rev-pension-h3-2026-10") };
    const marc = lignesComptables(d2, 2026, "2026-10-31").filter((l) => l.client === "Marc");
    expect(marc.filter((l) => l.type === "Recette").map((l) => `${l.montant}|${l.facture}`)).toEqual([`350|${inv.number}`]);
    expect(marc.reduce((t, l) => t + l.montant, 0)).toBe(0);
  });
});

