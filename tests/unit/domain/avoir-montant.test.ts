import { describe, expect, it } from "vitest";
import { contenuAvoir, contenuAvoirMontant, emettreAvoir, recettesFacturees, resteAAnnuler, resteEnEuros } from "@/lib/domain/facture";
import type { Invoice } from "@/lib/domain/types";

/** « Annuler par un avoir > Une partie > Un montant » (gérant G9) : une remise de 50 € pour une semaine d'absence. */
const facture = (over: Partial<Invoice> = {}): Invoice => ({
  id: "i1",
  number: "2026-0001",
  year: 2026,
  seq: 1,
  issuedAt: "2026-10-31",
  payer: "Claire Dubois",
  month: "2026-10",
  seller: { name: "Les Pommiers", ei: true },
  buyer: { name: "Claire Dubois" },
  franchise: true,
  lines: [
    { label: "Pension (Pacha)", kind: "pension", qty: 1, rate: 0, unitTTC: 350, unitHT: 350, totalTTC: 350, totalHT: 350, revenueIds: ["p1"] },
    { label: "Cours collectif", kind: "cours", qty: 2, rate: 0, unitTTC: 25, unitHT: 25, totalTTC: 50, totalHT: 50, revenueIds: ["c1", "c2"] },
  ],
  totalHT: 400,
  vat: [{ rate: 0, base: 400, amount: 0 }],
  totalTTC: 400,
  paid: 0,
  due: 400,
  revenueIds: ["p1", "c1", "c2"],
  ...over,
});

describe("l'avoir d'un montant libre", () => {
  it("une ligne au motif donné, en négatif, qui cite la facture", () => {
    const inv = facture();
    const c = contenuAvoirMontant(inv, 50, "Une semaine d’absence", [inv])!;
    expect(c).toMatchObject({ kind: "avoir", avoirDe: { number: "2026-0001" }, totalTTC: -50, totalHT: -50, paid: 0, due: 0, revenueIds: [] });
    expect(c.lines).toEqual([{ label: "Une semaine d’absence", kind: "pension", qty: 1, rate: 0, unitTTC: 50, unitHT: 50, totalTTC: -50, totalHT: -50 }]);
    const a = emettreAvoir({ invoices: [inv], invoiceSeq: { "2026": 1 } }, c, "2026-11-02", "a1");
    expect(a.number).toBe("2026-0002");
  });
  it("sans motif : « Remise »", () => {
    expect(contenuAvoirMontant(facture(), 20, "  ", undefined)!.lines[0].label).toBe("Remise");
  });
  it("jamais plus que ce qui reste de la facture, ni zéro", () => {
    const inv = facture();
    expect(contenuAvoirMontant(inv, 0, "x", [inv])).toBeNull();
    expect(contenuAvoirMontant(inv, 400.01, "x", [inv])).toBeNull();
    expect(contenuAvoirMontant(inv, 400, "x", [inv])!.totalTTC).toBe(-400);
  });
  it("les lignes restent facturées ; ce qui reste à annuler baisse du montant", () => {
    const inv = facture();
    const a = emettreAvoir({ invoices: [inv] }, contenuAvoirMontant(inv, 50, "Absence", [inv])!, "2026-11-02", "a1");
    const all = [inv, a];
    expect(recettesFacturees(all).get("p1")).toBe("2026-0001");
    expect(resteEnEuros(inv, all)).toBe(350);
    expect(resteAAnnuler(inv, all)).toEqual([1, 2]);
    // Toute la facture n'est plus possible (400 € > 350 €) ; un deuxième montant, oui, jusqu'à 350 €.
    expect(contenuAvoir(inv, resteAAnnuler(inv, all), all)).toBeNull();
    expect(contenuAvoirMontant(inv, 350, "Solde", all)!.totalTTC).toBe(-350);
    expect(contenuAvoirMontant(inv, 351, "Solde", all)).toBeNull();
    // Une ligne seule reste possible si elle tient dans ce qui reste.
    expect(contenuAvoir(inv, [0, 2], all)!.totalTTC).toBe(-50);
  });
  it("avec deux taux de TVA, le montant se répartit au prorata et la TVA rendue est juste", () => {
    const inv = facture({
      franchise: false,
      lines: [
        { label: "Pension", kind: "pension", qty: 1, rate: 20, unitTTC: 300, unitHT: 250, totalTTC: 300, totalHT: 250 },
        { label: "Cours", kind: "cours", qty: 4, rate: 5.5, unitTTC: 25, unitHT: 23.7, totalTTC: 100, totalHT: 94.8 },
      ],
      totalTTC: 400,
    });
    const c = contenuAvoirMontant(inv, 50, "Absence", [inv])!;
    expect(c.lines.map((l) => [l.label, l.rate, l.totalTTC])).toEqual([
      ["Absence (TVA 5,5 %)", 5.5, -12.5],
      ["Absence (TVA 20 %)", 20, -37.5],
    ]);
    expect(c.totalTTC).toBe(-50);
    expect(c.vat.find((v) => v.rate === 20)).toEqual({ rate: 20, base: -31.25, amount: -6.25 });
  });
  it("pas d'avoir sur un avoir", () => {
    expect(contenuAvoirMontant(facture({ kind: "avoir", totalTTC: -50 }), 10, "x", undefined)).toBeNull();
  });
});
