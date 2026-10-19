import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Feuille, resteApresAvoirs } from "@/components/bs/feuille-facture";
import { contenuAvoir, contenuAvoirMontant, emettre, emettreAvoir, type Brouillon } from "@/lib/domain/facture";
import type { Invoice } from "@/lib/domain/types";

/**
 * Une facture faite se réimprime à l'identique, même après un avoir (rapport
 * strict du 19 octobre, N10) : son « Reste à payer » est celui du jour où
 * elle est partie ; l'avoir est un document à part. Et l'avoir reprend le
 * vendeur de la facture qu'il annule.
 */
const contenu: NonNullable<Brouillon["facture"]> = {
  payer: "Claire Durand",
  month: "2026-10",
  buyer: { name: "Claire Durand" },
  franchise: true,
  lines: [{ label: "Pension (Belle)", kind: "pension", qty: 1, rate: 0, unitTTC: 400, unitHT: 400, totalTTC: 400, totalHT: 400, revenueIds: ["r1"] }],
  totalHT: 400,
  vat: [{ rate: 0, base: 400, amount: 0 }],
  totalTTC: 400,
  paid: 0,
  due: 400,
  revenueIds: ["r1"],
};
const billing = { legalName: "Écurie des Prés", statut: "ei" as const, address: "1 rue du Pré", siret: "12345678900012", vat: "franchise" as const };
const facture = emettre({ invoices: [], invoiceSeq: {}, billing, holding: {} }, contenu, "2026-10-19", "f1");
const html = (inv: Invoice) => renderToStaticMarkup(createElement(Feuille, { inv }));

describe("la facture réimprimée après un avoir", () => {
  it("est identique à celle qui est partie : même reste à payer, aucune ligne d'avoir", () => {
    const avant = html(facture);
    const partiel = emettreAvoir({ invoices: [facture], invoiceSeq: { "2026": 1 } }, contenuAvoirMontant(facture, 50, "Une semaine d’absence", [facture])!, "2026-10-25", "a1");
    const total = emettreAvoir({ invoices: [facture, partiel], invoiceSeq: { "2026": 2 } }, contenuAvoirMontant(facture, 350, "", [facture, partiel])!, "2026-10-26", "a2");
    // La facture elle-même ne bouge pas, et sa feuille non plus.
    expect(html(facture)).toBe(avant);
    expect(avant).toContain("Reste à payer");
    expect(avant).toContain("400,00 €");
    expect(avant).not.toContain("Avoir n°");
    expect(avant).not.toContain("Annulée");
    // Ce qui reste vraiment se dit à part (à l'écran) : 350 € après le premier avoir, 0 après les deux.
    expect(resteApresAvoirs(facture, [partiel])).toBe(350);
    expect(resteApresAvoirs(facture, [partiel, total])).toBe(0);
  });

  it("l'avoir reprend le vendeur de la facture qu'il annule, même si les infos ont changé depuis", () => {
    const c = contenuAvoir(facture, [1], [facture])!;
    expect(c.seller).toEqual(facture.seller);
    const feuille = html(emettreAvoir({ invoices: [facture], invoiceSeq: { "2026": 1 } }, c, "2026-11-03", "a3"));
    expect(feuille).toContain("Sur la facture n° 2026-0001 du 19 octobre 2026");
    expect(feuille).toContain("Écurie des Prés");
  });
});
