import { describe, expect, it } from "vitest";
import { capitalDit, emettre, enteteVendeur, ibanCleOk, ibanDit, ibanErreur, ibanValide, mentionIban, vendeurDe, vendeurManque, type Brouillon } from "@/lib/domain/facture";
import type { BillingInfo, Invoice } from "@/lib/domain/types";

/**
 * Les mentions du vendeur (décision 15 et rapport de suivi, partie 3) :
 * « EI » après le nom d'un entrepreneur individuel, forme juridique et
 * capital sous le nom d'une société, IBAN facultatif en pied de facture.
 * Une facture déjà faite garde ce qu'elle imprimait.
 */
const BASE: BillingInfo = { legalName: "Julie Martin", address: "1 rue du Pré", siret: "12345678900012", vat: "franchise" };

const contenu = (): NonNullable<Brouillon["facture"]> => ({
  payer: "Hugo L.",
  month: "2026-10",
  buyer: { name: "Hugo L." },
  franchise: true,
  lines: [{ label: "Pension", kind: "pension", qty: 1, rate: 0, unitTTC: 400, unitHT: 400, totalTTC: 400, totalHT: 400 }],
  totalHT: 400,
  vat: [{ rate: 0, base: 400, amount: 0 }],
  totalTTC: 400,
  paid: 0,
  due: 400,
  revenueIds: ["r1"],
});
const faire = (billing: BillingInfo) => emettre({ invoices: [], invoiceSeq: {}, billing, holding: {} }, contenu(), "2026-10-19", "i1");

describe("le statut du vendeur", () => {
  it("se choisit une fois : la facture le demande tant qu'il manque", () => {
    expect(vendeurManque(BASE)).toEqual(["statut"]);
    expect(vendeurManque({ ...BASE, statut: "ei" })).toEqual([]);
  });
  it("une société donne sa forme juridique et son capital", () => {
    expect(vendeurManque({ ...BASE, statut: "societe" })).toEqual(["forme", "capital"]);
    expect(vendeurManque({ ...BASE, statut: "societe", forme: "EARL" })).toEqual(["capital"]);
    expect(vendeurManque({ ...BASE, statut: "societe", forme: "EARL", capital: "7500" })).toEqual([]);
  });
});

describe("l'en-tête imprimé", () => {
  it("entrepreneur individuel : « EI » après le nom, sans doublon", () => {
    expect(enteteVendeur(faire({ ...BASE, statut: "ei", forme: "SARL" }).seller)).toEqual({ nom: "Julie Martin EI" });
    expect(enteteVendeur(faire({ ...BASE, legalName: "Julie Martin EI", statut: "ei" }).seller).nom).toBe("Julie Martin EI");
    expect(enteteVendeur({ name: "Julie Martin, entrepreneur individuel", ei: true }).nom).toBe("Julie Martin, entrepreneur individuel");
  });
  it("société : la forme et le capital sous le nom", () => {
    const inv = faire({ ...BASE, legalName: "Écurie des Prés", statut: "societe", forme: "EARL", capital: "7500" });
    expect(inv.seller).toMatchObject({ name: "Écurie des Prés", forme: "EARL", capital: "7500" });
    expect(inv.seller.ei).toBeUndefined();
    expect(enteteVendeur(inv.seller)).toEqual({ nom: "Écurie des Prés", sous: "EARL au capital de 7 500 €" });
  });
  it("le capital s'écrit à la française, ou tel que tapé", () => {
    expect(capitalDit("7500")).toBe("7 500 €");
    expect(capitalDit("7 500 €")).toBe("7 500 €");
    expect(capitalDit("1500,50")).toBe("1 500,5 €");
    expect(capitalDit("variable")).toBe("variable");
  });
  it("une facture faite avant le choix du statut ne change pas", () => {
    const ancienne: Invoice["seller"] = { name: "Les Pommiers", forme: "EI", siret: "12345678900012" };
    expect(enteteVendeur(ancienne)).toEqual({ nom: "Les Pommiers EI" });
    expect(enteteVendeur({ name: "Les Pommiers" })).toEqual({ nom: "Les Pommiers" });
  });
});

describe("l'IBAN", () => {
  const IBAN = "FR76 3000 6000 0112 3456 7890 189";
  it("contrôle complet : pays, longueur du pays, clé modulo 97 ; espaces et minuscules tolérés", () => {
    expect(ibanValide(IBAN)).toBe(true);
    expect(ibanValide("fr7630006000011234567890189")).toBe(true);
    expect(ibanCleOk("FR7630006000011234567890189")).toBe(true);
    expect(ibanValide("FR76 3000 6000 0112 3456 7890 18")).toBe(false);
    expect(ibanDit("fr7630006000011234567890189")).toBe(IBAN);
  });
  it("une faute de frappe ne passe pas : la clé est fausse", () => {
    // Le « FR00 0000… » de l'audit, et un chiffre changé dans un vrai IBAN.
    expect(ibanValide("FR00 0000 0000 0000 0000 0000 000")).toBe(false);
    expect(ibanValide("FR7630006000011234567890188")).toBe(false);
    expect(ibanValide("FR7630006000011234576890189")).toBe(false);
    expect(ibanErreur("FR7630006000011234567890188")).toMatch(/faute de frappe/);
  });
  it("les IBAN étrangers de la zone SEPA sont acceptés (N26 en Allemagne, Revolut en Lituanie, Belgique)", () => {
    expect(ibanValide("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(ibanValide("LT12 1000 0111 0100 1000")).toBe(true);
    expect(ibanValide("BE68 5390 0754 7034")).toBe(true);
    expect(ibanValide("GB82 WEST 1234 5698 7654 32")).toBe(true);
    expect(ibanValide("CH93 0076 2011 6238 5295 7")).toBe(true);
  });
  it("le message dit ce qui ne va pas", () => {
    expect(ibanErreur("")).toBe("");
    expect(ibanErreur(IBAN)).toBe("");
    expect(ibanErreur("FR76 3000 6000 0112 3456 7890 18")).toBe("Un IBAN français a 27 caractères : tu en as 26.");
    expect(ibanErreur("DE89 3704 0044 0532 0130")).toBe("Un IBAN allemand a 22 caractères : tu en as 20.");
    expect(ibanErreur("ZZ12 3456")).toMatch(/« ZZ » n’est pas le début d’un IBAN/);
    expect(ibanErreur("1234")).toMatch(/commence par deux lettres/);
    expect(ibanErreur("FRAB 3000")).toMatch(/deux chiffres/);
  });
  it("rempli, il part sur la facture et s'imprime en pied", () => {
    const inv = faire({ ...BASE, statut: "ei", iban: "fr76 3000 6000 0112 3456 7890 189" });
    expect(inv.seller.iban).toBe("FR7630006000011234567890189");
    expect(mentionIban(inv.seller.iban)).toBe(`Paiement par virement : IBAN ${IBAN}`);
  });
  it("vide ou mal formé : rien n'est imprimé", () => {
    expect(faire({ ...BASE, statut: "ei" }).seller.iban).toBeUndefined();
    expect(vendeurDe({ ...BASE, iban: "FR12" }, true).iban).toBeUndefined();
    expect(vendeurDe({ ...BASE, iban: "FR7630006000011234567890188" }, true).iban).toBeUndefined();
    expect(mentionIban(undefined)).toBe("");
  });
  it("une facture déjà figée avec un IBAN d'avant le contrôle s'imprime toujours comme elle est partie", () => {
    expect(mentionIban("FR0000000000000000000000000")).toBe("Paiement par virement : IBAN FR00 0000 0000 0000 0000 0000 000");
  });
  it("une facture déjà figée garde son vendeur quand les infos changent", () => {
    const inv = faire({ ...BASE, statut: "ei" });
    const avant = JSON.stringify(inv.seller);
    vendeurDe({ ...BASE, statut: "societe", forme: "EARL", capital: "7500", iban: IBAN }, true);
    expect(JSON.stringify(inv.seller)).toBe(avant);
  });
});
