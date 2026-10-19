import { describe, expect, it } from "vitest";
import { annulationsDuMois, billTotals, type Bill } from "@/lib/domain/billing";
import { contenuAvoirMontant, fusionFactures } from "@/lib/domain/facture";
import { repartirPaiement } from "@/lib/domain/paiement";
import type { Invoice, InvoiceLine, Revenue } from "@/lib/domain/types";

/**
 * Les cinq erreurs glissées dans les fonctions d'argent qu'aucun test
 * n'attrapait (audit technique du 19 octobre, test de mutation) : chacune a
 * maintenant son test.
 */

const ligne = (rate: 5.5 | 10 | 20, ttc: number, kind: InvoiceLine["kind"]): InvoiceLine => ({ label: kind, kind, qty: 1, rate, unitTTC: ttc, unitHT: ttc, totalTTC: ttc, totalHT: ttc });
const facture = (over: Partial<Invoice> = {}): Invoice => ({
  id: "i1",
  number: "2026-0001",
  year: 2026,
  seq: 1,
  issuedAt: "2026-10-20",
  payer: "Claire D.",
  month: "2026-10",
  seller: { name: "Les Pommiers" },
  buyer: { name: "Claire D." },
  franchise: false,
  lines: [],
  totalHT: 0,
  vat: [],
  totalTTC: 0,
  paid: 0,
  due: 0,
  revenueIds: [],
  ...over,
});

describe("les cas limites de l'argent", () => {
  it("avoir d'un montant sur une facture à trois taux : le centime d'arrondi n'est pas perdu", () => {
    const inv = facture({ lines: [ligne(5.5, 100, "pension"), ligne(10, 100, "cours"), ligne(20, 100, "autre")], totalTTC: 300 });
    const a = contenuAvoirMontant(inv, 100, "Geste", [inv])!;
    expect(a.lines.map((l) => l.totalTTC)).toEqual([-33.33, -33.33, -33.34]);
    expect(a.totalTTC).toBe(-100);
  });

  it("paiement plus gros que le dû : le surplus reste sur le dernier mois, il ne disparaît pas", () => {
    const parts = repartirPaiement(
      [
        { month: "2026-09", due: 120 },
        { month: "2026-10", due: 400 },
      ],
      600,
    );
    expect(parts).toEqual([
      { month: "2026-09", amount: 120 },
      { month: "2026-10", amount: 480 },
    ]);
    expect(parts.reduce((t, p) => t + p.amount, 0)).toBe(600);
  });

  it("Facturer : un reçu ne compte jamais au-delà du total de la note", () => {
    const note = (payer: string, total: number, paid: number): Bill => ({ payer, role: "proprietaire", lines: [], total, paid, due: Math.max(0, total - paid) });
    expect(billTotals([note("A", 390, 500), note("B", 390, 100)])).toMatchObject({ total: 780, paid: 490, due: 290 });
  });

  it("avoir d'un montant réparti par cheval : le centime restant va au dernier cheval", () => {
    const rev = (id: string, horseId: string): Revenue => ({ id, stableId: "s", horseId, amount: 100, date: "2026-10-01", source: "recurring" });
    const revenues = [rev("r1", "h1"), rev("r2", "h2"), rev("r3", "h3")];
    const inv = facture({ revenueIds: ["r1", "r2", "r3"], totalTTC: 300 });
    const avoir = facture({ id: "a1", number: "2026-0002", seq: 2, kind: "avoir", avoirDe: { number: "2026-0001", issuedAt: "2026-10-20" }, lines: [ligne(20, -100, "autre")], totalTTC: -100 });
    const [x] = annulationsDuMois({ invoices: [inv, avoir], revenues }, "2026-10");
    expect(x.parCheval).toEqual([
      { horseId: "h1", amount: 33.33 },
      { horseId: "h2", amount: 33.33 },
      { horseId: "h3", amount: 33.34 },
    ]);
    expect(x.amount).toBe(100);
  });

  it("fusion des factures de deux appareils : pour une même facture, la première copie reste", () => {
    const ici = facture({ totalTTC: 390 });
    const ailleurs = facture({ totalTTC: 999 });
    const f = fusionFactures({ invoices: [ici], invoiceSeq: { "2026": 1 } }, { invoices: [ailleurs], invoiceSeq: { "2026": 1 } });
    expect(f.invoices).toHaveLength(1);
    expect(f.invoices[0].totalTTC).toBe(390);
    expect(f.invoiceSeq).toEqual({ "2026": 1 });
  });
});
