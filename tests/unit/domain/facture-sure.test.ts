import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  brouillon,
  clientManque,
  contenuAvoir,
  de,
  deMois,
  emettre,
  emettreAvoir,
  eur2,
  facturation,
  fusionFactures,
  mentionsPaiement,
  messageFaite,
  moisAFacturer,
  prochainNumero,
  recettesFacturees,
  resteAAnnuler,
  tvaIntraDuSiret,
  tvaIntraValide,
} from "@/lib/domain/facture";
import { cellule, csvComptable, lignesComptables } from "@/lib/domain/comptable";
import { buildDemoData } from "@/lib/data/demo-data";
import type { BillingInfo, Invoice, StableData } from "@/lib/domain/types";

const oct = { year: 2026, month: 10 };
const B: BillingInfo = { legalName: "Les Pommiers", forme: "EI", vat: "franchise", address: "1 rue du Pré", siret: "12345678900012" };

const base = (extra: Partial<StableData> = {}): StableData => ({
  horses: [{ id: "h1", stableId: "s", name: "Tonnerre", entryDate: "2024-01-01", exitDate: null, isArchived: false, ownerName: "Hugo L." }],
  revenues: [
    { id: "p1", stableId: "s", horseId: "h1", categoryId: "cp", amount: 450, date: "2026-10-01", source: "recurring" },
    { id: "c1", stableId: "s", horseId: "h1", categoryId: "cc", amount: 25, date: "2026-10-08", source: "manual", payer: "Hugo L.", seanceId: "s1" },
    { id: "c2", stableId: "s", horseId: "h1", categoryId: "cc", amount: 25, date: "2026-10-15", source: "manual", payer: "Hugo L.", seanceId: "s2" },
  ],
  directExpenses: [],
  sharedExpenses: [],
  revenueCategories: [
    { id: "cp", name: "Pension" },
    { id: "cc", name: "Cours" },
  ],
  expenseCategories: [{ id: "ea", name: "Assurance", isDirect: false }],
  people: [{ id: "x", name: "Hugo L.", role: "proprietaire", active: true, statut: "particulier" }],
  billing: B,
  ...extra,
});

const faire = (d: StableData, payer = "Hugo L.", today = "2026-10-20", id = "i1", haut?: Record<string, number>) => emettre(d, brouillon(d, payer, oct).facture!, today, id, haut);

describe("numérotation qui ne recule jamais", () => {
  it("le compteur de l'appareil compte : une sauvegarde reprise ne fait pas revenir un numéro", () => {
    // Factures 1 à 5 sauvegardées, puis 6 faite, puis la sauvegarde reprise : le carnet ne connaît plus que 5.
    const sauvegarde = { invoices: [], invoiceSeq: { "2026": 5 } };
    expect(prochainNumero(sauvegarde.invoices, sauvegarde.invoiceSeq, 2026).number).toBe("2026-0006");
    expect(prochainNumero(sauvegarde.invoices, sauvegarde.invoiceSeq, 2026, { "2026": 6 }).number).toBe("2026-0007");
  });

  it("reprendre une sauvegarde garde les factures faites depuis, et le plus grand compteur", () => {
    const d = base();
    const a = faire(d);
    const apres = { invoices: [a], invoiceSeq: { "2026": 6 } };
    const reprise = { invoices: [] as Invoice[], invoiceSeq: { "2026": 5 } };
    const f = fusionFactures(reprise, apres, { "2026": 6 });
    expect(f.invoices.map((i) => i.id)).toEqual([a.id]);
    expect(f.invoiceSeq["2026"]).toBe(6);
    // Une même facture des deux côtés ne compte qu'une fois.
    expect(fusionFactures(apres, apres).invoices).toHaveLength(1);
  });

  it("deux onglets : l'autre onglet relu juste avant, le numéro suivant ne réutilise pas le sien", () => {
    const d = base();
    const marie = faire(d, "Hugo L.", "2026-10-20", "ongletA");
    // L'onglet B relit le carnet enregistré par A avant de numéroter.
    const relu = fusionFactures({ invoices: [], invoiceSeq: {} }, { invoices: [marie], invoiceSeq: { "2026": marie.seq } });
    expect(prochainNumero(relu.invoices, relu.invoiceSeq, 2026).number).toBe("2026-0002");
    // Les recettes déjà facturées par A ne repassent pas sur une facture de B.
    expect(brouillon({ ...d, ...relu }, "Hugo L.", oct).vide).toBe(true);
  });
});

describe("facture conforme", () => {
  it("le client : particulier ou professionnel jamais deviné ; un professionnel a besoin de son adresse et des conditions", () => {
    expect(clientManque(undefined, B)).toEqual(["statut"]);
    expect(clientManque({ statut: "particulier" }, B)).toEqual([]);
    expect(clientManque({ statut: "pro" }, B)).toEqual(["adresse", "conditions"]);
    expect(clientManque({ statut: "pro", address: "2 rue" }, { ...B, delaiPro: 30, penalites: "bce10" })).toEqual([]);
    const sans = base({ people: [{ id: "x", name: "Hugo L.", role: "proprietaire", active: true }] });
    const b = brouillon(sans, "Hugo L.", oct);
    expect(b.client).toEqual(["statut"]);
    expect(b.facture).toBeUndefined();
  });

  it("un professionnel : échéance, pénalités, 40 € et pas d'escompte ; vendeur EI ; TVA intracommunautaire avec la TVA", () => {
    const d = base({
      people: [{ id: "x", name: "Hugo L.", role: "proprietaire", active: true, statut: "pro", address: "Haras du Pin\n61310 Le Pin" }],
      billing: { ...B, vat: "taux", rates: { pension: 20, cours: 5.5 }, tvaIntra: "fr 32 123456789", delaiPro: 30, penalites: "bce10" },
    });
    const inv = faire(d);
    expect(inv.seller).toEqual({ name: "Les Pommiers", forme: "EI", address: "1 rue du Pré", siret: "12345678900012", tvaIntra: "FR32123456789" });
    expect(inv.buyer).toMatchObject({ pro: true, address: "Haras du Pin\n61310 Le Pin" });
    expect(inv.echeance).toBe("2026-11-19");
    const m = mentionsPaiement(inv).join(" ");
    expect(m).toContain("Date d’échéance : 19 novembre 2026.");
    expect(m).toContain("BCE majoré de 10 points");
    expect(m).toContain("indemnité forfaitaire pour frais de recouvrement de 40 €");
    expect(m).toContain("Pas d’escompte");
    expect(m).not.toContain("Payable à réception");
    expect(m).not.toContain("—");
  });

  it("un particulier : « Payable à réception » seulement s'il reste un dû, sinon « Payée le … par … »", () => {
    const d = base();
    expect(mentionsPaiement(faire(d))).toEqual(["Payable à réception."]);
    const paye = base({ payments: [{ id: "p", payer: "Hugo L.", month: "2026-10", amount: 500, at: "2026-10-17T10:00:00", method: "cheque" }] });
    const inv = faire(paye);
    expect(inv.due).toBe(0);
    expect(mentionsPaiement(inv)).toEqual(["Payée le 17 octobre 2026 par chèque."]);
    // Pas de mention de pro pour un particulier.
    expect(mentionsPaiement(inv).join(" ")).not.toContain("40 €");
  });

  it("le SIRET est le même pour les factures et le registre", () => {
    expect(facturation({ billing: { legalName: "X" }, holding: { siret: "12345678900012" } }).siret).toBe("12345678900012");
    expect(facturation({ billing: { siret: "11111111100011" }, holding: { siret: "12345678900012" } }).siret).toBe("11111111100011");
  });

  it("le numéro de TVA : FR, la clé, le SIREN", () => {
    expect(tvaIntraValide("FR 32 123 456 789")).toBe(true);
    expect(tvaIntraValide("FR123")).toBe(false);
    expect(tvaIntraDuSiret("FR32123456789", "12345678900012")).toBe(true);
    expect(tvaIntraDuSiret("FR32999999999", "12345678900012")).toBe(false);
  });

  it("« d’octobre », « de mai », « d’août » partout", () => {
    expect(deMois("2026-10")).toBe("d’octobre 2026");
    expect(deMois("2026-05")).toBe("de mai 2026");
    expect(deMois("2026-08")).toBe("d’août 2026");
    expect(de("avril")).toBe("d’avril");
  });

  it("le message « Facture faite » échappe le nom du client et le numéro", () => {
    const m = messageFaite({ number: "2026-0001", payer: "<img src=x onerror=alert(1)>" });
    expect(m).not.toContain("<img");
    expect(m).toContain("&lt;img");
    expect(messageFaite({ kind: "avoir", number: "2026-<b>", payer: "x", avoirDe: { number: "2026-0001", issuedAt: "2026-10-01" } })).not.toContain("<b>");
  });
});

describe("l'avoir", () => {
  const avecFacture = () => {
    const d = base();
    const inv = faire(d);
    return { d: { ...d, invoices: [inv], invoiceSeq: { "2026": 1 } } as StableData, inv };
  };

  it("annule une partie, prend le numéro suivant, rend les recettes annulées", () => {
    const { d, inv } = avecFacture();
    const cours = inv.lines.findIndex((l) => l.kind === "cours");
    expect(inv.lines[cours].qty).toBe(2);
    const qtes = inv.lines.map((_, i) => (i === cours ? 1 : 0));
    const a = emettreAvoir(d, contenuAvoir(inv, qtes, d.invoices)!, "2026-10-21", "a1");
    expect(a).toMatchObject({ kind: "avoir", number: "2026-0002", avoirDe: { number: inv.number }, totalTTC: -25, due: 0 });
    expect(a.lines[0]).toMatchObject({ qty: 1, totalTTC: -25, de: cours });
    expect(eur2(a.totalTTC)).toBe("−25,00 €");
    const d2 = { ...d, invoices: [inv, a] };
    // Il reste un cours à annuler ; la recette rendue peut repasser sur une facture.
    expect(resteAAnnuler(inv, d2.invoices)[cours]).toBe(1);
    expect(recettesFacturees(d2.invoices).has(a.revenueIds[0])).toBe(false);
    expect(recettesFacturees(d2.invoices).get("p1")).toBe(inv.number);
    // Un avoir de toute la facture, après : seulement ce qui reste.
    const tout = contenuAvoir(inv, resteAAnnuler(inv, d2.invoices), d2.invoices)!;
    expect(tout.totalTTC).toBe(-475);
    expect(contenuAvoir(inv, inv.lines.map(() => 0), d2.invoices)).toBeNull();
  });

  it("apparaît dans le tableau du comptable, dans sa colonne, sans toucher aux recettes", () => {
    const { d, inv } = avecFacture();
    const a = emettreAvoir(d, contenuAvoir(inv, inv.lines.map((l) => l.qty), d.invoices)!, "2026-10-21", "a1");
    const csv = csvComptable({ ...d, invoices: [inv, a] }, 2026, "2026-10-31");
    expect(csv).toContain(`21/10/2026;Avoir;Avoir;Sur la facture n° ${inv.number};;Hugo L.;;;;-500,00;;${a.number}`);
    const recettes = lignesComptables({ ...d, invoices: [inv, a] }, 2026, "2026-10-31").filter((l) => l.type === "Recette");
    expect(recettes.reduce((t, l) => t + l.montant, 0)).toBe(500);
  });
});

describe("le tableau du comptable, sûr", () => {
  it("les textes qui commencent par = + - @, tabulation ou retour chariot reçoivent une apostrophe ; pas les montants", () => {
    expect(cellule('=HYPERLINK("http://x","Voir")')).toBe(`"'=HYPERLINK(""http://x"",""Voir"")"`);
    expect(cellule("+33 6 12 34 56 78")).toBe("'+33 6 12 34 56 78");
    expect(cellule("-2+3")).toBe("'-2+3");
    expect(cellule("@SUM(1+1)")).toBe("'@SUM(1+1)");
    expect(cellule("\t=1+1")).toBe("'\t=1+1");
    expect(cellule("\r=1")).toBe(`"'\r=1"`);
    expect(cellule("Foin")).toBe("Foin");
    const d = base({ directExpenses: [{ id: "e", stableId: "s", horseId: "h1", label: "=1+1", amount: 12.5, date: "2026-10-02", source: "manual" }] });
    d.revenues.push({ id: "neg", stableId: "s", horseId: "h1", amount: -20, date: "2026-10-03", source: "manual", note: "@remise", payer: "+33 6" });
    const csv = csvComptable(d, 2026, "2026-10-31");
    expect(csv).toContain(";'=1+1;");
    expect(csv).toContain(";'@remise;Tonnerre;'+33 6;-20,00;");
    expect(csv).toContain(";;12,50;;;;");
  });

  it("aucun mois à venir : le 20 octobre, rien de novembre ni de décembre", () => {
    const d = base({ recurringExpenses: [{ id: "r", stableId: "s", label: "Frais fixes", amount: 900, isShared: true, frequency: "monthly", startDate: "2026-01-01", source: "manual" }] });
    const ls = lignesComptables(d, 2026, "2026-10-20");
    expect(ls.filter((l) => l.libelle === "Frais fixes").map((l) => l.date.slice(5, 7))).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]);
    expect(ls.some((l) => l.date > "2026-10-20")).toBe(false);
  });

  it("1 000 € par an font 1 000 € sur l'année, pas 999,96 €", () => {
    const d = base({
      recurringExpenses: [{ id: "r", stableId: "s", label: "Assurance", categoryId: "ea", amount: 83.33, isShared: true, frequency: "monthly", startDate: "2026-01-01", source: "manual", saisi: { mode: "an", montant: 1000 } }],
    });
    const ls = lignesComptables(d, 2026, "2026-12-31").filter((l) => l.categorie === "Assurance");
    expect(ls).toHaveLength(12);
    expect(Math.round(ls.reduce((t, l) => t + l.montant, 0) * 100) / 100).toBe(1000);
    expect(ls.every((l) => l.montant === 83.33 || l.montant === 83.34)).toBe(true);
    const fois = base({ recurringExpenses: [{ id: "f", stableId: "s", label: "Foin", amount: 250, isShared: true, frequency: "monthly", startDate: "2026-01-01", source: "manual", saisi: { mode: "fois", montant: 1500, fois: 2 } }] });
    expect(lignesComptables(fois, 2026, "2026-12-31").reduce((t, l) => t + (l.type === "Dépense" ? l.montant : 0), 0)).toBe(3000);
  });

  it("la démo range chaque dépense dans sa catégorie (plus de « Compléments » sous « Maréchal-ferrant »)", () => {
    const demo = buildDemoData();
    const cat = (id?: string) => demo.expenseCategories.find((c) => c.id === id)?.name;
    const compl = demo.directExpenses.filter((e) => e.label === "Compléments");
    expect(compl.length).toBeGreaterThan(0);
    expect(compl.every((e) => cat(e.categoryId) === "Compléments")).toBe(true);
    expect(demo.directExpenses.filter((e) => e.label === "Maréchal-ferrant").every((e) => cat(e.categoryId) === "Maréchal-ferrant")).toBe(true);
  });
});

describe("le mois des factures à faire", () => {
  it("début de mois : le mois d'avant s'il reste à facturer ; sinon le mois en cours", () => {
    const d = base();
    expect(moisAFacturer(d, "2026-11-03").period).toEqual(oct);
    expect(moisAFacturer(d, "2026-10-20")).toEqual({ period: oct, clients: ["Hugo L."] });
    const inv = faire(d);
    expect(moisAFacturer({ ...d, invoices: [inv] }, "2026-10-20").clients).toEqual([]);
  });
});

describe("aucun message des écrans de facture n'injecte un texte saisi sans l'échapper", () => {
  const fichiers = [
    "app/(app)/facture/page.tsx",
    "app/(app)/facturation/page.tsx",
    "app/(app)/registre/page.tsx",
    "app/(app)/client/page.tsx",
    "components/bs/facturation.tsx",
    "components/bs/moyen-paiement.tsx",
    "components/bs/retirer.ts",
  ];
  // Ce qui peut entrer dans un message sans échappement : des nombres, des montants formatés par l'app.
  const sur = /^(esc\(|eur\(|eur2\(|enMoyen\(|an\b|n\b|out\.length\b|surFacture\(\))/;
  it.each(fichiers)("%s", (f) => {
    const src = readFileSync(join(process.cwd(), f), "utf8");
    expect(src).not.toMatch(/innerHTML/);
    for (const m of src.matchAll(/say\(\s*`([^`]*)`/g)) {
      for (const x of m[1].matchAll(/\$\{([^}]*)\}/g)) expect(x[1].trim(), `${f} : say(\`${m[1]}\`)`).toMatch(sur);
    }
  });
});
