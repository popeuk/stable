import { describe, expect, it } from "vitest";
import { brouillon, emettre, facturesDe, horsTaxes, kindOf, messageFacture, prochainNumero, siretValide, tauxManquants, totaux, vendeurManque } from "@/lib/domain/facture";
import { COLONNES, cellule, csvComptable, lignesComptables, nombreFr } from "@/lib/domain/comptable";
import { dernierMoyen, moyenDit } from "@/lib/domain/paiement";
import type { BillingInfo, Invoice, StableData } from "@/lib/domain/types";

const oct = { year: 2026, month: 10 };
const TAUX: BillingInfo = { legalName: "Les Pommiers", nomPrenom: "Julie Martin", statut: "ei", vat: "taux", rates: { pension: 20, cours: 5.5, soins: 20, autre: 10 }, address: "1 rue du Pré\n72000 Le Mans", siret: "123 456 789 00012", tvaIntra: "FR32123456789" };

const base = (billing?: BillingInfo): StableData => ({
  horses: [{ id: "h1", stableId: "s", name: "Tonnerre", entryDate: "2024-01-01", exitDate: null, isArchived: false, ownerName: "Hugo L." }],
  revenues: [
    { id: "p1", stableId: "s", horseId: "h1", categoryId: "cp", amount: 450, date: "2026-10-01", source: "recurring" },
    { id: "c1", stableId: "s", horseId: "h1", categoryId: "cc", amount: 25, date: "2026-10-08", source: "manual", payer: "Hugo L.", seanceId: "s1" },
    { id: "c2", stableId: "s", horseId: "h1", categoryId: "cc", amount: 25, date: "2026-10-15", source: "manual", payer: "Hugo L.", seanceId: "s2" },
    { id: "v1", stableId: "s", horseId: "h1", amount: 60, date: "2026-10-10", source: "manual", note: "Maréchal refacturé", rebillOf: "d1" },
  ],
  directExpenses: [{ id: "d1", stableId: "s", horseId: "h1", categoryId: "em", label: "Maréchal", amount: 60, date: "2026-10-10", source: "manual", rebillRevenueId: "v1" }],
  sharedExpenses: [{ id: "sh", stableId: "s", categoryId: "ef", label: "Foin; luzerne", totalAmount: 1234.5, periodMonth: 10, periodYear: 2026, distributionMode: "equal", source: "manual", allocations: [] }],
  revenueCategories: [
    { id: "cp", name: "Pension" },
    { id: "cc", name: "Cours" },
  ],
  expenseCategories: [
    { id: "em", name: "Maréchal", isDirect: true },
    { id: "ef", name: "Foin", isDirect: false },
  ],
  people: [{ id: "x", name: "Hugo L.", role: "proprietaire", active: true, address: "3 allée des Saules", statut: "particulier", nomComplet: "Hugo Durand" }],
  payments: [{ id: "pay", payer: "Hugo L.", month: "2026-10", amount: 100, at: "2026-10-05T10:00:00", method: "cheque", chequeNumber: "1234567" }],
  ...(billing ? { billing } : {}),
});

describe("numérotation des factures", () => {
  it("part de 0001, suit l'année, ne réutilise jamais un numéro", () => {
    expect(prochainNumero([], {}, 2026)).toEqual({ seq: 1, number: "2026-0001" });
    const inv = [
      { year: 2026, seq: 1 },
      { year: 2026, seq: 2 },
      { year: 2025, seq: 9 },
    ];
    expect(prochainNumero(inv, {}, 2026).number).toBe("2026-0003");
    // Une facture disparue du carnet : le compteur garde son numéro.
    expect(prochainNumero([{ year: 2026, seq: 1 }], { "2026": 5 }, 2026).number).toBe("2026-0006");
    // Nouvelle année : on repart à 1.
    expect(prochainNumero(inv, { "2026": 2 }, 2027).number).toBe("2027-0001");
  });

  it("deux factures émises de suite ont deux numéros qui se suivent, contenu figé", () => {
    const d = base(TAUX);
    const b = brouillon(d, "Hugo L.", oct);
    const a = emettre(d, b.facture!, "2026-10-31", "i1");
    const d2 = { ...d, invoices: [a], invoiceSeq: { "2026": a.seq } };
    const b2 = brouillon(d2, "Hugo L.", oct);
    expect(b2.vide).toBe(true);
    // Une recette ajoutée après : elle va sur une nouvelle facture, la première ne bouge pas.
    d2.revenues = [...d2.revenues, { id: "c3", stableId: "s", horseId: "h1", categoryId: "cc", amount: 25, date: "2026-10-30", source: "manual", payer: "Hugo L.", seanceId: "s3" }];
    const b3 = brouillon(d2, "Hugo L.", oct);
    const c = emettre(d2, b3.facture!, "2026-11-02", "i2");
    expect([a.number, c.number]).toEqual(["2026-0001", "2026-0002"]);
    expect(c.revenueIds).toEqual(["c3"]);
    expect(a.totalTTC).toBe(560);
    expect(facturesDe([c, a], "hugo l.", "2026-10").map((i) => i.number)).toEqual(["2026-0001", "2026-0002"]);
  });
});

describe("HT, TVA et TTC", () => {
  it("le TTC reste ce que paie le client, le HT s'en déduit taux par taux", () => {
    expect(horsTaxes(120, 20)).toBe(100);
    expect(horsTaxes(25, 5.5)).toBe(23.7);
    const t = totaux([
      { rate: 20, totalTTC: 450 },
      { rate: 20, totalTTC: 60 },
      { rate: 5.5, totalTTC: 50 },
    ]);
    expect(t.totalTTC).toBe(560);
    expect(t.vat).toEqual([
      { rate: 5.5, base: 47.39, amount: 2.61 },
      { rate: 20, base: 425, amount: 85 },
    ]);
    expect(t.totalHT).toBe(472.39);
    expect(t.totalHT + t.vat.reduce((s, v) => s + v.amount, 0)).toBeCloseTo(560, 2);
  });

  it("la facture regroupe les lignes, applique le taux de chaque type, compte le déjà payé", () => {
    const f = brouillon(base(TAUX), "Hugo L.", oct).facture!;
    expect(f.lines.map((l) => [l.label, l.kind, l.qty, l.rate, l.unitTTC])).toEqual([
      ["Pension (Tonnerre)", "pension", 1, 20, 450],
      ["Cours", "cours", 2, 5.5, 25],
      ["Maréchal refacturé (Tonnerre)", "soins", 1, 20, 60],
    ]);
    expect(f.lines[1].unitHT).toBe(23.7);
    expect(f).toMatchObject({ totalTTC: 560, paid: 100, due: 460, franchise: false, buyer: { name: "Hugo Durand", address: "3 allée des Saules" }, payer: "Hugo L." });
  });

  it("en franchise : pas de TVA, HT = TTC", () => {
    const f = brouillon(base({ ...TAUX, vat: "franchise" }), "Hugo L.", oct).facture!;
    expect(f.franchise).toBe(true);
    expect(f.vat).toEqual([{ rate: 0, base: 560, amount: 0 }]);
    expect(f.totalHT).toBe(560);
  });

  it("l'app ne devine jamais le taux : rien de choisi, ou un taux qui manque, et pas de facture", () => {
    const rien = brouillon(base(), "Hugo L.", oct);
    expect(rien.tvaAChoisir).toBe(true);
    expect(rien.facture).toBeUndefined();
    const partiel = brouillon(base({ vat: "taux", rates: { pension: 20 } }), "Hugo L.", oct);
    expect(partiel.manquants).toEqual(["cours", "soins"]);
    expect(partiel.facture).toBeUndefined();
    expect(tauxManquants({ vat: "franchise" })).toEqual([]);
  });

  it("le vendeur : son nom (jamais celui de l'écurie par défaut), adresse, SIRET de 14 chiffres, TVA intracommunautaire avec la TVA", () => {
    expect(vendeurManque(undefined)).toEqual(["statut", "adresse", "siret"]);
    expect(vendeurManque(TAUX)).toEqual([]);
    expect(vendeurManque({ ...TAUX, tvaIntra: undefined })).toEqual(["tva"]);
    expect(vendeurManque({ ...TAUX, vat: "franchise", tvaIntra: undefined })).toEqual([]);
    expect(siretValide("123 456 789 0001")).toBe(false);
  });

  it("le type d'une recette : pension, cours, soins, le reste", () => {
    expect(kindOf({ note: "Pension box" })).toBe("pension");
    expect(kindOf({ seanceId: "s" })).toBe("cours");
    expect(kindOf({ rebillOf: "d" })).toBe("soins");
    expect(kindOf({ note: "Transport" })).toBe("autre");
  });

  it("le message dit le numéro, le mois et le montant", () => {
    const m = messageFacture({ payer: "Hugo L.", number: "2026-0004", month: "2026-10", totalTTC: 560, due: 460 }, "Claire");
    expect(m).toContain("n° 2026-0004");
    expect(m).toContain("octobre 2026");
    expect(m).toContain("560,00 €");
    expect(m).toContain("460,00 €");
    expect(m).not.toContain("—");
  });
});

describe("moyen de paiement", () => {
  it("le dernier moyen du client par défaut, et le chèque avec son numéro", () => {
    const ps = [
      { id: "a", payer: "Hugo L.", month: "2026-09", amount: 1, at: "2026-09-02T10:00:00", method: "virement" as const },
      { id: "b", payer: "hugo l.", month: "2026-10", amount: 1, at: "2026-10-02T10:00:00", method: "especes" as const },
      { id: "c", payer: "Hugo L.", month: "2026-10", amount: 1, at: "2026-10-03T10:00:00" },
    ];
    expect(dernierMoyen(ps, "Hugo L.")).toBe("especes");
    expect(dernierMoyen(ps, "Lucie")).toBeUndefined();
    expect(moyenDit({ method: "cheque", chequeNumber: "42" })).toBe("chèque n° 42");
    expect(moyenDit({})).toBe("");
  });
});

describe("le tableau du comptable", () => {
  const withInv = (): StableData => {
    const d = base(TAUX);
    const inv: Invoice = emettre(d, brouillon(d, "Hugo L.", oct).facture!, "2026-10-31", "i1");
    return { ...d, invoices: [inv] };
  };

  it("BOM, point-virgule, en-tête, décimales à la virgule, CRLF, chaque montant dans la colonne de sa nature", () => {
    const csv = csvComptable(withInv(), 2026, "2026-10-31");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe(COLONNES.join(";"));
    expect(lines[0]).toBe("Date;Nature;Catégorie;Libellé;Cheval;Client;Recette TTC;Dépense TTC;Encaissement TTC;Avoir TTC;Moyen de paiement;N° de facture");
    // Le libellé n'est pas la catégorie répétée.
    expect(csv).toContain("01/10/2026;Recette;Pension;;Tonnerre;Hugo L.;450,00;;;;chèque;2026-0001");
    expect(csv).toContain('01/10/2026;Dépense;Foin;"Foin; luzerne";commun;;;1234,50;;;;');
    expect(csv).toContain("10/10/2026;Dépense;Maréchal;;Tonnerre;;;60,00;;;;");
    expect(csv).toContain("05/10/2026;Encaissement;Paiement reçu;Paiement d’octobre 2026;;Hugo L.;;;100,00;;chèque n° 1234567;2026-0001");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("une ligne par recette, dépense et paiement de l'année, rien des autres années ni d'après aujourd'hui", () => {
    const d = withInv();
    d.revenues.push({ id: "old", stableId: "s", horseId: "h1", amount: 10, date: "2025-12-31", source: "manual" });
    d.directExpenses.push({ id: "ass", stableId: "s", horseId: "h1", label: "Assurance", amount: 30, date: "2026-10-15", source: "manual" });
    const ls = lignesComptables(d, 2026, "2026-10-20");
    expect(ls.filter((l) => l.type === "Recette")).toHaveLength(4);
    expect(ls.filter((l) => l.libelle === "Assurance").map((l) => l.date)).toEqual(["2026-10-15"]);
    expect(ls.filter((l) => l.type === "Encaissement")).toHaveLength(1);
    expect(ls.some((l) => l.date.startsWith("2025"))).toBe(false);
    // Le 14 octobre, l'assurance du 15 n'a pas encore eu lieu.
    expect(lignesComptables(d, 2026, "2026-10-14").filter((l) => l.libelle === "Assurance")).toHaveLength(0);
  });

  it("les cellules à risque sont protégées, les nombres à la française", () => {
    expect(cellule('Dit "oui"')).toBe('"Dit ""oui"""');
    expect(cellule("a\nb")).toBe('"a\nb"');
    expect(nombreFr(1234.5)).toBe("1234,50");
    expect(nombreFr(0.1 + 0.2)).toBe("0,30");
  });
});
