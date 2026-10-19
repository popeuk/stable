import { describe, expect, it } from "vitest";
import { lienFacture, messageRetiree, numeroDit, numeroterProvisoires, numerosEnDouble, rendreProvisoire } from "@/lib/domain/numeros";
import type { Invoice } from "@/lib/domain/types";

const f = (id: string, seq: number, extra: Partial<Invoice> = {}): Invoice => ({
  id,
  number: `2026-${String(seq).padStart(4, "0")}`,
  year: 2026,
  seq,
  issuedAt: "2026-10-18",
  payer: id,
  month: "2026-10",
  seller: { name: "Julie Martin", ei: true },
  buyer: { name: id },
  franchise: true,
  lines: [],
  totalHT: 10,
  vat: [],
  totalTTC: 10,
  paid: 0,
  due: 10,
  revenueIds: [id],
  ...extra,
});

describe("les factures à numéroter (sans réseau)", () => {
  it("une facture provisoire n'a pas de numéro et ne compte pas dans la suite", () => {
    const p = rendreProvisoire(f("claire", 3), "2026-10-19T09:00:00.000Z");
    expect(p.seq).toBe(0);
    expect(p.provisoire).toBe("2026-10-19T09:00:00.000Z");
    expect(numeroDit(p)).toBe("à numéroter");
    expect(lienFacture(p)).toBe("/facture?id=claire");
    expect(lienFacture(f("hugo", 2))).toBe("/facture?n=2026-0002");
  });

  it("au retour du réseau : numérotées dans l'ordre où elles ont été faites, à la suite du plus grand numéro connu, datées du jour", () => {
    const deux = rendreProvisoire(f("hugo", 0), "2026-10-19T10:00:00.000Z");
    const une = rendreProvisoire(f("claire", 0, { buyer: { name: "EARL", pro: true }, echeance: "2026-11-17" }), "2026-10-19T09:00:00.000Z");
    // L'autre appareil a fait la 0005 pendant ce temps (relue en ligne).
    const r = numeroterProvisoires([f("a", 4), deux, une, f("b", 5)], { "2026": 5 }, "2026-10-21");
    expect(r.numerotees.map((i) => [i.id, i.number])).toEqual([
      ["claire", "2026-0006"],
      ["hugo", "2026-0007"],
    ]);
    const claire = r.numerotees[0];
    expect(claire.provisoire).toBeUndefined();
    expect(claire.issuedAt).toBe("2026-10-21");
    // Son échéance garde son délai de 30 jours.
    expect(claire.echeance).toBe("2026-11-20");
    expect(r.invoices.map((i) => i.number)).toEqual(["2026-0004", "2026-0007", "2026-0006", "2026-0005"]);
  });

  it("le compteur de l'appareil compte aussi", () => {
    const r = numeroterProvisoires([rendreProvisoire(f("x", 0), "2026-10-19T09:00:00.000Z")], {}, "2026-10-21", { "2026": 9 });
    expect(r.numerotees[0].number).toBe("2026-0010");
  });

  it("une provisoire dont les lignes ont été facturées sur l'autre appareil n'est pas numérotée : elle est retirée", () => {
    // Le téléphone, sans réseau, a fait la facture de Claire ; l'ordinateur, en ligne, l'a faite aussi (0001).
    const provisoire = rendreProvisoire(f("tel", 0, { payer: "Claire", revenueIds: ["r1", "r2"] }), "2026-10-19T09:00:00.000Z");
    const ailleurs = f("pc", 1, { payer: "Claire", revenueIds: ["r1", "r2"] });
    const autre = rendreProvisoire(f("hugo", 0), "2026-10-19T10:00:00.000Z");
    const r = numeroterProvisoires([ailleurs, provisoire, autre], { "2026": 1 }, "2026-10-21");
    expect(r.numerotees.map((i) => [i.id, i.number])).toEqual([["hugo", "2026-0002"]]);
    expect(r.retirees).toEqual([{ facture: provisoire, numeros: ["2026-0001"], toute: true }]);
    expect(r.invoices.map((i) => i.id)).toEqual(["pc", "hugo"]);
    expect(messageRetiree(r.retirees[0])).toBe("Ce mois de Claire a déjà été facturé sur ton autre appareil, n° <strong>2026-0001</strong> : la facture provisoire est retirée.");
  });

  it("une seule ligne déjà facturée suffit à la retirer ; le reste revient dans Facturer, et un avoir libère la ligne", () => {
    const provisoire = rendreProvisoire(f("tel", 0, { payer: "Léa <b>", revenueIds: ["r1", "r9"] }), "2026-10-19T09:00:00.000Z");
    const ailleurs = f("pc", 1, { revenueIds: ["r1"] });
    const r = numeroterProvisoires([ailleurs, provisoire], {}, "2026-10-21");
    expect(r.retirees[0].toute).toBe(false);
    expect(messageRetiree(r.retirees[0])).toContain("Léa &lt;b&gt;");
    expect(messageRetiree(r.retirees[0])).toContain("Ce qui n’y était pas revient dans Facturer.");
    // La facture de l'ordinateur annulée par un avoir : la ligne est libre, la provisoire est numérotée.
    const avoir = f("av", 2, { kind: "avoir", revenueIds: ["r1"], avoirDe: { number: "2026-0001", issuedAt: "2026-10-18" } });
    const r2 = numeroterProvisoires([ailleurs, avoir, provisoire], {}, "2026-10-21");
    expect(r2.retirees).toEqual([]);
    expect(r2.numerotees.map((i) => i.number)).toEqual(["2026-0003"]);
  });

  it("rien à numéroter : rien ne change", () => {
    const l = [f("a", 1)];
    expect(numeroterProvisoires(l, {}, "2026-10-21")).toEqual({ invoices: l, numerotees: [], retirees: [] });
  });
});

describe("deux factures au même numéro", () => {
  it("sont signalées après une fusion, les provisoires mises à part", () => {
    const l = [f("a", 1), f("b", 2), f("c", 2), rendreProvisoire(f("d", 0), "2026-10-19T09:00:00.000Z")];
    const d = numerosEnDouble(l);
    expect(d).toHaveLength(1);
    expect(d[0].number).toBe("2026-0002");
    expect(d[0].factures.map((i) => i.id)).toEqual(["b", "c"]);
    expect(numerosEnDouble([f("a", 1), f("b", 2)])).toEqual([]);
  });
});
