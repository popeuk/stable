import { describe, expect, it } from "vitest";
import { brouillon, contenuAvoir, emettre, emettreAvoir, enteteVendeur, MENTION_ASSOCIATION, MENTION_FRANCHISE, mentionTvaDe, vendeurManque } from "@/lib/domain/facture";
import { facturePdf } from "@/lib/domain/facture-pdf";
import type { BillingInfo, Invoice, StableData } from "@/lib/domain/types";

const oct = { year: 2026, month: 10 };
const ASSO: BillingInfo = { statut: "association", legalName: "Les Cavaliers des Prés", rna: "W723000123", address: "1 rue du Pré\n72000 Le Mans", vat: "association" };

const base = (billing: BillingInfo): StableData => ({
  horses: [{ id: "h1", stableId: "s", name: "Tonnerre", entryDate: "2024-01-01", exitDate: null, isArchived: false, ownerName: "Hugo L." }],
  revenues: [{ id: "p1", stableId: "s", horseId: "h1", categoryId: "cp", amount: 450, date: "2026-10-01", source: "recurring" }],
  directExpenses: [],
  sharedExpenses: [],
  revenueCategories: [{ id: "cp", name: "Pension" }],
  expenseCategories: [],
  people: [{ id: "x", name: "Hugo L.", role: "proprietaire", active: true, statut: "particulier", address: "3 allée des Saules", nomComplet: "Hugo Durand" }],
  billing,
});
const faire = (b: BillingInfo) => emettre(base(b), brouillon(base(b), "Hugo L.", oct).facture!, "2026-10-20", "i1");

describe("une association dans Tes factures", () => {
  it("la mention cite la disposition du CGI qui l'exonère", () => {
    expect(MENTION_ASSOCIATION).toBe("TVA non applicable, art. 261-7-1° du CGI");
  });

  it("ce qu'il lui faut : son nom et son adresse ; ni capital, ni RCS, ni SIRET obligatoire", () => {
    expect(vendeurManque({ statut: "association" })).toEqual(["nomAsso", "adresse"]);
    expect(vendeurManque(ASSO)).toEqual([]);
    // Un RNA ou un SIRET noté doit être juste.
    expect(vendeurManque({ ...ASSO, rna: "W12" })).toEqual(["rna"]);
    expect(vendeurManque({ ...ASSO, siret: "123" })).toEqual(["siret"]);
    expect(vendeurManque({ ...ASSO, siret: "12345678900012" })).toEqual([]);
  });

  it("la facture : son nom, « Association, RNA … », pas de TVA, sa mention ; ni capital ni RCS", () => {
    const inv = faire({ ...ASSO, forme: "SARL", capital: "7500", rcs: "Angers", siret: "12345678900012" });
    expect(inv.franchise).toBe(true);
    expect(inv.lines.every((l) => l.rate === 0)).toBe(true);
    expect(inv.mentionTva).toBe(MENTION_ASSOCIATION);
    expect(inv.seller).toMatchObject({ name: "Les Cavaliers des Prés", association: true, rna: "W723000123", siret: "12345678900012" });
    expect(inv.seller.capital).toBeUndefined();
    expect(inv.seller.rcs).toBeUndefined();
    expect(inv.seller.forme).toBeUndefined();
    expect(enteteVendeur(inv.seller)).toEqual({ nom: "Les Cavaliers des Prés", sous: "Association, RNA W723000123" });
    expect(enteteVendeur({ ...inv.seller, rna: undefined })).toEqual({ nom: "Les Cavaliers des Prés", sous: "Association" });
    expect(mentionTvaDe(inv)).toBe(MENTION_ASSOCIATION);
    const pdf = Buffer.from(facturePdf(inv)).toString("latin1");
    expect(pdf).toContain("261-7-1");
    expect(pdf).not.toContain("293 B");
  });

  it("une association en franchise garde la mention de la franchise", () => {
    const inv = faire({ ...ASSO, vat: "franchise" });
    expect(inv.mentionTva).toBeUndefined();
    expect(mentionTvaDe(inv)).toBe(MENTION_FRANCHISE);
  });

  it("l'avoir garde la mention de sa facture", () => {
    const d = base(ASSO);
    const inv = faire(ASSO);
    const c = contenuAvoir(inv, inv.lines.map((l) => l.qty), [inv])!;
    const avo = emettreAvoir({ ...d, invoices: [inv] }, c, "2026-10-21", "a1");
    expect(mentionTvaDe(avo)).toBe(MENTION_ASSOCIATION);
  });

  it("les factures figées ne bougent pas : une facture d'avant s'imprime comme avant", () => {
    const ancienne = { ...faire({ ...ASSO, statut: "societe", vat: "franchise" }), mentionTva: undefined } as Invoice;
    expect(mentionTvaDe(ancienne)).toBe(MENTION_FRANCHISE);
    expect(mentionTvaDe({ franchise: false })).toBe("");
    // Passer l'écurie en association ne change rien à ce qui est déjà émis.
    expect(enteteVendeur(ancienne.seller).sous ?? "").not.toContain("Association");
  });
});
