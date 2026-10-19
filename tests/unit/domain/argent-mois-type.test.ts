import { describe, expect, it } from "vitest";
import { billOf, dueOf } from "@/lib/domain/billing";
import { aggregateStablePnl, horsePnl, stablePnl } from "@/lib/domain/calculations";
import { clientDues } from "@/lib/domain/clients";
import { lignesComptables } from "@/lib/domain/comptable";
import { brouillon, contenuAvoir, contenuAvoirMontant, emettre, emettreAvoir } from "@/lib/domain/facture";
import { horseTicket, monthBreakdown } from "@/lib/domain/ticket";
import type { BillingInfo, Invoice, StableData } from "@/lib/domain/types";

/**
 * L'argent d'un mois type, de bout en bout (octobre 2026, on est le 25) :
 * trois pensions (Belle à Claire, Tonnerre à Hugo, Pacha à Léa), un cheval
 * à moi (Gribouille), une estimation de foin à 900 € avec une vraie
 * livraison de 120 € « dedans ». Claire est facturée (pension et un cours)
 * et paie une partie ; Hugo est facturé puis tout est annulé par un avoir ;
 * Léa est facturée puis reçoit un avoir de 50 € ; elle règle aussi sa
 * pension de septembre, en octobre. Mon bilan, ce que chacun doit et le
 * fichier du comptable doivent dire la même chose.
 */
const sept = { year: 2026, month: 9 };
const oct = { year: 2026, month: 10 };
const today = "2026-10-25";
const B: BillingInfo = { legalName: "Les Pommiers", forme: "EI", vat: "franchise", address: "1 rue du Pré", siret: "12345678900012" };
const r2 = (n: number) => Math.round(n * 100) / 100;

function moisType() {
  let d: StableData = {
    horses: [
      { id: "belle", stableId: "s", name: "Belle", entryDate: "2024-01-01", isArchived: false, ownerName: "Claire D.", pensionType: "Pré" },
      { id: "ton", stableId: "s", name: "Tonnerre", entryDate: "2024-01-01", isArchived: false, ownerName: "Hugo L.", pensionType: "Box" },
      { id: "pacha", stableId: "s", name: "Pacha", entryDate: "2024-01-01", isArchived: false, ownerName: "Léa M.", pensionType: "Box" },
      { id: "gri", stableId: "s", name: "Gribouille", entryDate: "2024-01-01", isArchived: false, pensionType: "À moi" },
    ],
    revenues: [
      { id: "rev-pension-pacha-2026-09", stableId: "s", horseId: "pacha", categoryId: "cp", amount: 400, date: "2026-09-01", source: "recurring" },
      { id: "rev-pension-belle-2026-10", stableId: "s", horseId: "belle", categoryId: "cp", amount: 350, date: "2026-10-01", source: "recurring" },
      { id: "rev-pension-ton-2026-10", stableId: "s", horseId: "ton", categoryId: "cp", amount: 350, date: "2026-10-01", source: "recurring" },
      { id: "rev-pension-pacha-2026-10", stableId: "s", horseId: "pacha", categoryId: "cp", amount: 400, date: "2026-10-01", source: "recurring" },
      { id: "cours", stableId: "s", horseId: "belle", categoryId: "cc", amount: 25, date: "2026-10-08", source: "manual", payer: "Claire D.", seanceId: "s1" },
    ],
    directExpenses: [{ id: "mar", stableId: "s", horseId: "gri", categoryId: "em", label: "Maréchal", amount: 60, date: "2026-10-12", source: "manual" }],
    sharedExpenses: [
      { id: "liv", stableId: "s", categoryId: "foin", label: "Livraison de foin", totalAmount: 120, periodMonth: 10, periodYear: 2026, distributionMode: "equal", source: "manual", allocations: [], dansEstimation: true },
    ],
    revenueCategories: [
      { id: "cp", name: "Pension" },
      { id: "cc", name: "Cours" },
    ],
    expenseCategories: [
      { id: "foin", name: "Foin", isDirect: false },
      { id: "em", name: "Maréchal-ferrant", isDirect: true },
    ],
    // L'« à peu près » de Mes frais : le foin, 900 € par mois.
    recurringExpenses: [{ id: "est-foin", stableId: "s", label: "Foin", amount: 900, categoryId: "foin", isShared: true, distributionMode: "equal", frequency: "monthly", startDate: "2026-01-01", endDate: null, source: "manual" }],
    people: [
      { id: "c", name: "Claire D.", role: "proprietaire", active: true, statut: "particulier", nomComplet: "Claire Durand" },
      { id: "h", name: "Hugo L.", role: "proprietaire", active: true, statut: "particulier", nomComplet: "Hugo Durand" },
      { id: "l", name: "Léa M.", role: "proprietaire", active: true, statut: "particulier", nomComplet: "Léa Durand" },
    ],
    payments: [
      // Léa règle septembre le 5 octobre ; Claire paie 200 € sur ses 375 €.
      { id: "pl", payer: "Léa M.", month: "2026-09", amount: 400, at: "2026-10-05T10:00:00", method: "virement" },
      { id: "pc", payer: "Claire D.", month: "2026-10", amount: 200, at: "2026-10-22T10:00:00", method: "cheque" },
    ],
    billing: B,
    invoices: [],
    invoiceSeq: {},
  };
  const facturer = (payer: string, jour: string, id: string): Invoice => {
    const inv = emettre(d, brouillon(d, payer, oct).facture!, jour, id);
    d = { ...d, invoices: [...(d.invoices ?? []), inv], invoiceSeq: { "2026": inv.seq } };
    return inv;
  };
  const avoir = (c: Parameters<typeof emettreAvoir>[1], jour: string, id: string): Invoice => {
    const a = emettreAvoir(d, c, jour, id);
    d = { ...d, invoices: [...(d.invoices ?? []), a], invoiceSeq: { "2026": a.seq } };
    return a;
  };
  const fClaire = facturer("Claire D.", "2026-10-20", "f1");
  const fHugo = facturer("Hugo L.", "2026-10-20", "f2");
  const fLea = facturer("Léa M.", "2026-10-20", "f3");
  const aHugo = avoir(contenuAvoir(fHugo, fHugo.lines.map((l) => l.qty), d.invoices)!, "2026-10-21", "a1");
  const aLea = avoir(contenuAvoirMontant(fLea, 50, "Une semaine d’absence", d.invoices)!, "2026-10-23", "a2");
  return { d, fClaire, fHugo, fLea, aHugo, aLea };
}

describe("l'argent d'un mois type, de bout en bout", () => {
  it("les numéros se suivent : trois factures, deux avoirs", () => {
    const { fClaire, fHugo, fLea, aHugo, aLea } = moisType();
    expect([fClaire, fHugo, fLea, aHugo, aLea].map((i) => i.number)).toEqual(["2026-0001", "2026-0002", "2026-0003", "2026-0004", "2026-0005"]);
    expect([fClaire.totalTTC, fHugo.totalTTC, fLea.totalTTC, aHugo.totalTTC, aLea.totalTTC]).toEqual([375, 350, 400, -350, -50]);
  });

  it("Mon bilan d'octobre : la recette moins les avoirs, le foin compté 900 € et pas 1 020 €", () => {
    const { d } = moisType();
    const s = stablePnl(d, oct);
    // 350 + 25 + 350 + 400 = 1 125 €, moins l'avoir de Hugo (350 €) et celui de Léa (50 €).
    expect(s.revenue).toBe(725);
    expect(s.directCosts).toBe(60);
    expect(s.sharedCosts).toBe(900);
    expect(s.netResult).toBe(-235);
    expect(s.horseCount).toBe(4);
    // Le détail s'additionne au chiffre du mois.
    const m = monthBreakdown(d, oct);
    expect(r2(m.ins.reduce((t, x) => t + x.amount, 0))).toBe(m.revenue);
    expect(m.ins.find((x) => x.label === "Avoirs")!.amount).toBe(-400);
    expect(r2(m.shared.reduce((t, x) => t + x.amount, 0))).toBe(900);
    expect(m.pensions).toBe(3);
    expect(m.miens).toBe(1);
  });

  it("la fiche de chaque cheval suit Mon bilan", () => {
    const { d } = moisType();
    expect(horsePnl(d, "belle", oct).revenue).toBe(375);
    expect(horsePnl(d, "ton", oct).revenue).toBe(0);
    expect(horsePnl(d, "pacha", oct).revenue).toBe(350);
    expect(horsePnl(d, "gri", oct)).toMatchObject({ revenue: 0, directCosts: 60, sharedCosts: 225 });
    const s = stablePnl(d, oct);
    expect(r2(["belle", "ton", "pacha", "gri"].reduce((t, h) => t + horseTicket(d, h, oct).net, 0))).toBe(s.netResult);
    for (const h of ["belle", "ton", "pacha", "gri"]) {
      const t = horseTicket(d, h, oct);
      expect(r2(t.lines.reduce((u, l) => u + l.amount, 0))).toBe(t.net);
    }
  });

  it("Sur plusieurs mois : septembre et octobre, sans rien retirer deux fois", () => {
    const { d } = moisType();
    expect(aggregateStablePnl(d, [sept, oct]).revenue).toBe(1125);
  });

  it("ce que chaque client doit", () => {
    const { d, aHugo, aLea } = moisType();
    expect(dueOf(d, "Claire D.", oct)).toBe(175);
    expect(dueOf(d, "Hugo L.", oct)).toBe(0);
    expect(dueOf(d, "Léa M.", oct)).toBe(350);
    expect(dueOf(d, "Léa M.", sept)).toBe(0);
    // Sa fiche montre l'avoir.
    expect(billOf(d, "Hugo L.", oct)!.avoirs).toEqual([{ number: aHugo.number, amount: 350 }]);
    expect(billOf(d, "Léa M.", oct)!.avoirs).toEqual([{ number: aLea.number, amount: 50 }]);
    const dues = clientDues(d, oct);
    const doit = (n: string) => dues.find((c) => c.name === n)!;
    expect(doit("Claire D.").due).toBe(175);
    expect(doit("Hugo L.").due).toBe(0);
    expect(doit("Léa M.")).toMatchObject({ due: 350, anciens: [] });
  });

  it("le fichier du comptable : le réel, chaque avoir une fois, et il retombe sur Mon bilan", () => {
    const { d, fClaire, fHugo, fLea, aHugo, aLea } = moisType();
    const ls = lignesComptables(d, 2026, today);
    const de = (t: string) => ls.filter((l) => l.type === t);
    expect(de("Recette").map((l) => `${l.date}|${l.cheval}|${l.montant}|${l.facture}`).sort()).toEqual([
      "2026-09-01|Pacha|400|",
      "2026-10-01|Belle|350|" + fClaire.number,
      "2026-10-01|Pacha|400|" + fLea.number,
      "2026-10-01|Tonnerre|350|" + fHugo.number,
      "2026-10-08|Belle|25|" + fClaire.number,
    ]);
    // Le maréchal de Gribouille et la vraie livraison ; ni le foin estimé (900 €) ni son reste (780 €).
    expect(de("Dépense").map((l) => `${l.libelle || l.categorie}|${l.montant}`).sort()).toEqual(["Livraison de foin|120", "Maréchal|60"]);
    expect(de("Encaissement").map((l) => `${l.date}|${l.client}|${l.montant}|${l.moyen}`)).toEqual(["2026-10-05|Léa M.|400|virement", "2026-10-22|Claire D.|200|chèque"]);
    expect(de("Avoir").map((l) => `${l.client}|${l.montant}|${l.facture}`)).toEqual([`Hugo L.|-350|${aHugo.number}`, `Léa M.|-50|${aLea.number}`]);
    // Les recettes d'octobre et les avoirs : le même chiffre que Mon bilan.
    const octobre = ls.filter((l) => l.date.startsWith("2026-10") && (l.type === "Recette" || l.type === "Avoir"));
    expect(r2(octobre.reduce((t, l) => t + l.montant, 0))).toBe(stablePnl(d, oct).revenue);
    // Ce qui reste à recevoir : les recettes et avoirs de l'année moins les encaissements, comme les clients.
    const recu = de("Encaissement").reduce((t, l) => t + l.montant, 0);
    const vendu = [...de("Recette"), ...de("Avoir")].reduce((t, l) => t + l.montant, 0);
    expect(r2(vendu - recu)).toBe(r2(clientDues(d, oct).reduce((t, c) => t + c.due, 0)));
  });
});
