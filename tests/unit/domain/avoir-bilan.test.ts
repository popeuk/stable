import { describe, expect, it } from "vitest";
import { annulationsDuMois, dueOf } from "@/lib/domain/billing";
import { aggregateStablePnl, horsePnl, stablePnl } from "@/lib/domain/calculations";
import { brouillon, contenuAvoir, contenuAvoirMontant, emettre, emettreAvoir } from "@/lib/domain/facture";
import { horseTicket, monthBreakdown } from "@/lib/domain/ticket";
import type { BillingInfo, Invoice, StableData } from "@/lib/domain/types";

const oct = { year: 2026, month: 10 };
const nov = { year: 2026, month: 11 };
const B: BillingInfo = { legalName: "Les Pommiers", forme: "EI", vat: "franchise", address: "1 rue du Pré", siret: "12345678900012" };

/** Claire : la pension de Belle (350 €) et un cours sur Belle (25 €), plus Hugo et Tonnerre (350 €), facturés le 20 octobre. */
function base() {
  const d: StableData = {
    horses: [
      { id: "h1", stableId: "s", name: "Belle", entryDate: "2024-01-01", isArchived: false, ownerName: "Claire D." },
      { id: "h2", stableId: "s", name: "Tonnerre", entryDate: "2024-01-01", isArchived: false, ownerName: "Hugo L." },
    ],
    revenues: [
      { id: "p1", stableId: "s", horseId: "h1", categoryId: "cp", amount: 350, date: "2026-10-01", source: "recurring" },
      { id: "c1", stableId: "s", horseId: "h1", categoryId: "cc", amount: 25, date: "2026-10-08", source: "manual", payer: "Claire D.", seanceId: "s1" },
      { id: "p2", stableId: "s", horseId: "h2", categoryId: "cp", amount: 350, date: "2026-10-01", source: "recurring" },
      { id: "pac", stableId: "s", horseId: "", amount: 800, date: "2026-10-05", note: "PAC", source: "manual" },
    ],
    directExpenses: [],
    sharedExpenses: [],
    revenueCategories: [
      { id: "cp", name: "Pension" },
      { id: "cc", name: "Cours" },
    ],
    expenseCategories: [],
    people: [
      { id: "x", name: "Claire D.", role: "proprietaire", active: true, statut: "particulier", address: "3 allée des Saules", nomComplet: "Claire Durand" },
      { id: "y", name: "Hugo L.", role: "proprietaire", active: true, statut: "particulier", address: "3 allée des Saules", nomComplet: "Hugo Durand" },
    ],
    billing: B,
  };
  const inv = emettre(d, brouillon(d, "Claire D.", oct).facture!, "2026-10-20", "i1");
  return { d: { ...d, invoices: [inv], invoiceSeq: { "2026": 1 } } as StableData, inv };
}
const avec = (d: StableData, ...xs: Invoice[]): StableData => ({ ...d, invoices: [...(d.invoices ?? []), ...xs], invoiceSeq: { "2026": (d.invoices ?? []).length + xs.length } });

describe("un avoir annule une vente : Mon bilan retire la recette du mois de la facture", () => {
  it("sans avoir, rien ne change", () => {
    const { d } = base();
    expect(stablePnl(d, oct).revenue).toBe(1525);
    expect(annulationsDuMois(d, "2026-10")).toEqual([]);
  });

  it("avoir total : toute la recette de la facture s'en va, une seule fois, partout", () => {
    const { d, inv } = base();
    const a = emettreAvoir(d, contenuAvoir(inv, inv.lines.map((l) => l.qty), d.invoices)!, "2026-10-21", "a1");
    const d2 = avec(d, a);
    expect(stablePnl(d2, oct).revenue).toBe(1150);
    expect(horsePnl(d2, "h1", oct).revenue).toBe(0);
    expect(horsePnl(d2, "h2", oct).revenue).toBe(350);
    expect(dueOf(d2, "Claire D.", oct)).toBe(0);
    // La fiche du cheval montre l'avoir en moins, et son total suit Mon bilan.
    const t = horseTicket(d2, "h1", oct);
    expect(t.lines.find((l) => l.label === `Avoir n° ${a.number}`)!.amount).toBe(-375);
    expect(t.lines.reduce((s, l) => s + (l.kind === "in" ? l.amount : 0), 0)).toBe(t.revenue);
    // Le détail de Mon bilan s'additionne au chiffre du mois.
    const m = monthBreakdown(d2, oct);
    expect(m.ins.find((x) => x.label === "Avoirs")!.amount).toBe(-375);
    expect(m.ins.reduce((s, x) => s + x.amount, 0)).toBe(m.revenue);
    // Sur plusieurs mois : la même somme, retirée une fois.
    expect(aggregateStablePnl(d2, [oct, nov]).revenue).toBe(1150);
  });

  it("avoir par lignes : seulement ces lignes", () => {
    const { d, inv } = base();
    const cours = inv.lines.findIndex((l) => l.kind === "cours");
    const a = emettreAvoir(d, contenuAvoir(inv, inv.lines.map((_, i) => (i === cours ? 1 : 0)), d.invoices)!, "2026-10-21", "a1");
    const d2 = avec(d, a);
    expect(horsePnl(d2, "h1", oct).revenue).toBe(350);
    expect(stablePnl(d2, oct).revenue).toBe(1500);
    expect(dueOf(d2, "Claire D.", oct)).toBe(350);
  });

  it("avoir d'un montant : ce montant, rangé sur le cheval de la facture", () => {
    const { d, inv } = base();
    const a = emettreAvoir(d, contenuAvoirMontant(inv, 50, "Une semaine d’absence", d.invoices)!, "2026-10-21", "a1");
    const d2 = avec(d, a);
    expect(annulationsDuMois(d2, "2026-10")).toEqual([{ number: a.number, payer: "Claire D.", issuedAt: "2026-10-21", amount: 50, parCheval: [{ horseId: "h1", amount: 50 }] }]);
    expect(horsePnl(d2, "h1", oct).revenue).toBe(325);
    expect(stablePnl(d2, oct).revenue).toBe(1475);
    expect(dueOf(d2, "Claire D.", oct)).toBe(325);
  });

  it("avoir d'un montant sur une facture de deux chevaux : réparti au prorata, au centime", () => {
    const { d } = base();
    // Une facture à Hugo pour Tonnerre (350 €) et une recette de 50 € sur Belle qu'il paie.
    const d1 = { ...d, revenues: [...d.revenues, { id: "x1", stableId: "s", horseId: "h1", amount: 50, date: "2026-10-12", source: "manual" as const, payer: "Hugo L.", note: "Transport" }] };
    const inv = emettre(d1, brouillon(d1, "Hugo L.", oct).facture!, "2026-10-20", "i2");
    const d2 = avec(d1, inv);
    const a = emettreAvoir(d2, contenuAvoirMontant(inv, 100, "Geste", d2.invoices)!, "2026-10-21", "a1");
    const d3 = avec(d2, a);
    const par = annulationsDuMois(d3, "2026-10")[0].parCheval;
    expect(par.reduce((t, x) => t + x.amount, 0)).toBe(100);
    expect(par.find((x) => x.horseId === "h2")!.amount).toBe(87.5);
    expect(par.find((x) => x.horseId === "h1")!.amount).toBe(12.5);
    expect(stablePnl(d3, oct).revenue).toBe(stablePnl(d2, oct).revenue - 100);
  });

  it("fait en novembre sur la facture d'octobre : retiré d'octobre, pas de novembre", () => {
    const { d, inv } = base();
    const a = emettreAvoir(d, contenuAvoirMontant(inv, 50, "Remise", d.invoices)!, "2026-11-03", "a1");
    const d2 = avec(d, a);
    expect(stablePnl(d2, oct).revenue).toBe(1475);
    expect(stablePnl(d2, nov).revenue).toBe(0);
  });

  it("une recette annulée puis retirée de l'app ne se retire pas deux fois", () => {
    const { d, inv } = base();
    const pension = inv.lines.findIndex((l) => l.kind === "pension");
    const a = emettreAvoir(d, contenuAvoir(inv, inv.lines.map((_, i) => (i === pension ? 1 : 0)), d.invoices)!, "2026-10-21", "a1");
    const d2 = { ...avec(d, a), revenues: d.revenues.filter((r) => r.id !== "p1") };
    expect(horsePnl(d2, "h1", oct).revenue).toBe(25);
    expect(dueOf(d2, "Claire D.", oct)).toBe(25);
  });

  it("une recette annulée puis remise sur une nouvelle facture compte de nouveau", () => {
    const { d, inv } = base();
    const a = emettreAvoir(d, contenuAvoir(inv, inv.lines.map((l) => l.qty), d.invoices)!, "2026-10-21", "a1");
    const d2 = avec(d, a);
    const inv2 = emettre(d2, brouillon(d2, "Claire D.", oct).facture!, "2026-10-22", "i3");
    const d3 = avec(d2, inv2);
    expect(horsePnl(d3, "h1", oct).revenue).toBe(375);
    expect(dueOf(d3, "Claire D.", oct)).toBe(375);
  });
});
