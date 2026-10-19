import { describe, expect, it } from "vitest";
import { brouillon, capitalDit, emettre, estNomComplet, nomCompletDe, rcsDit, enteteVendeur, ibanCleOk, ibanDit, ibanErreur, ibanValide, mentionIban, vendeurDe, vendeurManque, type Brouillon } from "@/lib/domain/facture";
import type { BillingInfo, Invoice, Person, StableData } from "@/lib/domain/types";

/**
 * Les mentions du vendeur (décision 15 et rapport de suivi, partie 3) :
 * « EI » après le nom d'un entrepreneur individuel, forme juridique et
 * capital sous le nom d'une société, IBAN facultatif en pied de facture.
 * Une facture déjà faite garde ce qu'elle imprimait.
 */
const BASE: BillingInfo = { legalName: "Julie Martin", nomPrenom: "Julie Martin", address: "1 rue du Pré", siret: "12345678900012", vat: "franchise" };

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
  it("une société donne sa raison sociale, sa forme juridique, son capital et son RCS", () => {
    expect(vendeurManque({ ...BASE, legalName: "", statut: "societe" })).toEqual(["nom", "forme", "capital", "rcs"]);
    expect(vendeurManque({ ...BASE, statut: "societe" })).toEqual(["forme", "capital", "rcs"]);
    expect(vendeurManque({ ...BASE, statut: "societe", forme: "EARL" })).toEqual(["capital", "rcs"]);
    expect(vendeurManque({ ...BASE, statut: "societe", forme: "EARL", capital: "7500" })).toEqual(["rcs"]);
    expect(vendeurManque({ ...BASE, statut: "societe", forme: "EARL", capital: "7500", rcs: "Angers" })).toEqual([]);
  });
});

describe("l'en-tête imprimé", () => {
  it("entrepreneur individuel : « EI » après le nom, sans doublon", () => {
    expect(enteteVendeur(faire({ ...BASE, statut: "ei", forme: "SARL" }).seller)).toEqual({ nom: "Julie Martin EI" });
    expect(enteteVendeur(faire({ ...BASE, nomPrenom: "Julie Martin EI", statut: "ei" }).seller).nom).toBe("Julie Martin EI");
    expect(enteteVendeur({ name: "Julie Martin, entrepreneur individuel", ei: true }).nom).toBe("Julie Martin, entrepreneur individuel");
  });
  it("société : la forme et le capital sous le nom, puis le RCS avec la ville du greffe et le SIREN", () => {
    const inv = faire({ ...BASE, legalName: "Écurie des Prés", statut: "societe", forme: "EARL", capital: "7500", rcs: "Angers" });
    expect(inv.seller).toMatchObject({ name: "Écurie des Prés", forme: "EARL", capital: "7500", rcs: "RCS Angers 123 456 789" });
    expect(inv.seller.ei).toBeUndefined();
    expect(enteteVendeur(inv.seller)).toEqual({ nom: "Écurie des Prés", sous: "EARL au capital de 7 500 €", rcs: "RCS Angers 123 456 789" });
  });
  it("le RCS tapé n'importe comment s'écrit pareil", () => {
    expect(rcsDit("RCS Angers", "12345678900012")).toBe("RCS Angers 123 456 789");
    expect(rcsDit("r.c.s. Le Mans 123 456 789", "12345678900012")).toBe("RCS Le Mans 123 456 789");
    expect(rcsDit("", "12345678900012")).toBe("");
  });
  it("le capital s'écrit à la française, ou tel que tapé", () => {
    expect(capitalDit("7500")).toBe("7 500 €");
    expect(capitalDit("7 500 €")).toBe("7 500 €");
    expect(capitalDit("1500,50")).toBe("1 500,5 €");
    expect(capitalDit("variable")).toBe("variable");
  });
  it("entrepreneur individuel : le nom et le prénom sont obligatoires, le nom commercial s'ajoute dessous sans les remplacer (F31808)", () => {
    // « Écurie des Prés EI » sans nom ni prénom ne passe plus.
    expect(vendeurManque({ ...BASE, nomPrenom: undefined, legalName: "Écurie des Prés", statut: "ei" })).toEqual(["nomPrenom"]);
    const inv = faire({ ...BASE, nomPrenom: "Julie Martin", legalName: "Écurie des Prés", statut: "ei" });
    expect(inv.seller).toMatchObject({ name: "Julie Martin", ei: true, commercial: "Écurie des Prés" });
    expect(enteteVendeur(inv.seller)).toEqual({ nom: "Julie Martin EI", sous: "Écurie des Prés" });
  });
  it("une facture d'un entrepreneur individuel faite avant (« Écurie des Prés EI ») s'imprime toujours pareil", () => {
    expect(enteteVendeur({ name: "Écurie des Prés", ei: true })).toEqual({ nom: "Écurie des Prés EI" });
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

describe("le client sur la facture (F31808)", () => {
  it("un particulier : son nom complet ; « Claire D. », « Hugo », « M. Dupont » ne suffisent pas", () => {
    expect(estNomComplet("Sophie Martin")).toBe(true);
    expect(estNomComplet("Jean-Pierre Le Gall")).toBe(true);
    expect(estNomComplet("Claire D.")).toBe(false);
    expect(estNomComplet("Hugo")).toBe(false);
    expect(estNomComplet("M. Dupont")).toBe(false);
    expect(estNomComplet("Mme Dupont")).toBe(false);
    expect(nomCompletDe({ name: "Claire D.", nomComplet: "Claire Dubois" })).toBe("Claire Dubois");
    expect(nomCompletDe({ name: "Sophie Martin" })).toBe("Sophie Martin");
    expect(nomCompletDe({ name: "Hugo" })).toBe("");
  });

  it("la facture imprime le nom complet du particulier, et le numéro de TVA du pro s'il est noté", () => {
    const data = (person: Person): StableData => ({
      horses: [{ id: "h", stableId: "s", name: "Belle", entryDate: "2024-01-01", exitDate: null, isArchived: false }],
      revenues: [{ id: "r", stableId: "s", horseId: "h", categoryId: "p", amount: 400, date: "2026-10-01", source: "manual", payer: person.name, note: "Pension" }],
      directExpenses: [],
      sharedExpenses: [],
      revenueCategories: [{ id: "p", name: "Pension" }],
      expenseCategories: [],
      people: [person],
      billing: { ...BASE, statut: "ei", delaiPro: 30, penalites: "bce10" },
    });
    const oct = { year: 2026, month: 10 };
    const claire = brouillon(data({ id: "c", name: "Claire D.", role: "proprietaire", active: true, statut: "particulier" }), "Claire D.", oct);
    expect(claire.client).toEqual(["nomComplet"]);
    const avec = brouillon(data({ id: "c", name: "Claire D.", role: "proprietaire", active: true, statut: "particulier", nomComplet: "Claire Dubois" }), "Claire D.", oct);
    expect(avec.facture?.buyer.name).toBe("Claire Dubois");
    expect(avec.facture?.payer).toBe("Claire D.");
    const pro = brouillon(data({ id: "e", name: "EARL Les Tilleuls", role: "proprietaire", active: true, statut: "pro", address: "2 rue", tvaIntra: "FR32123456789" }), "EARL Les Tilleuls", oct);
    expect(pro.facture?.buyer).toMatchObject({ name: "EARL Les Tilleuls", pro: true, tvaIntra: "FR32123456789" });
    const sansTva = brouillon(data({ id: "e", name: "EARL Les Tilleuls", role: "proprietaire", active: true, statut: "pro", address: "2 rue" }), "EARL Les Tilleuls", oct);
    expect(sansTva.client).toEqual([]);
    expect(sansTva.facture?.buyer.tvaIntra).toBeUndefined();
  });
});
