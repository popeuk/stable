import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appelClient, emettre, messageFacture, messageFaite, prenomClient, type Brouillon } from "@/lib/domain/facture";
import { couper, facturePdf, largeur, nomFichierPdf } from "@/lib/domain/facture-pdf";
import { rendreProvisoire } from "@/lib/domain/numeros";

/** Les messages au client (rapport textes du 19 octobre) et le PDF joint quand le téléphone sait partager. */
const inv = { payer: "Claire D.", buyer: { name: "Claire Dubois" }, number: "2026-0004", month: "2026-10", totalTTC: 400, due: 400 };

describe("le bonjour", () => {
  it("le prénom quand le client est une personne", () => {
    expect(messageFacture(inv, "Julie").split("\n")[0]).toBe("Bonjour Claire,");
    expect(prenomClient({ name: "Hugo" })).toBe("Hugo");
    expect(prenomClient({ name: "Jean-Pierre Le Gall" })).toBe("Jean-Pierre");
  });
  it("« Bonjour, » pour une société, un pro, une civilité ou une initiale", () => {
    for (const name of ["EARL Les Tilleuls", "SCEA du Moulin", "M. Dupont", "Mme Martin", "Haras du Pin", "C. Dubois", "GAEC"]) expect(messageFacture({ ...inv, payer: name, buyer: { name } }, "Julie").split("\n")[0]).toBe("Bonjour,");
    expect(messageFacture({ ...inv, buyer: { name: "Claire Dubois", pro: true } }, "Julie").split("\n")[0]).toBe("Bonjour,");
    // Une ancienne facture sans client noté : le nom de l'app.
    expect(messageFacture({ ...inv, buyer: undefined }, "Julie").split("\n")[0]).toBe("Bonjour Claire,");
  });
  it("à l'écran : le prénom d'une personne, le nom entier d'une société", () => {
    expect(appelClient({ name: "Claire Dubois" }, "Claire D.")).toBe("Claire");
    expect(appelClient({ name: "EARL Les Tilleuls", pro: true }, "EARL Les Tilleuls")).toBe("EARL Les Tilleuls");
    expect(messageFaite({ kind: undefined, number: "2026-0004", payer: "EARL Les Tilleuls", buyer: { name: "EARL Les Tilleuls", pro: true } })).toBe("Facture n° 2026-0004 faite pour EARL Les Tilleuls.");
  });
});

describe("l'échéance d'un client professionnel", () => {
  it("le message dit la date de la facture, pas « Payable à réception »", () => {
    const m = messageFacture({ ...inv, payer: "EARL Les Tilleuls", buyer: { name: "EARL Les Tilleuls", pro: true }, echeance: "2026-11-18" }, "Julie");
    expect(m).toContain("À régler avant le 18 novembre 2026.");
    expect(m).not.toContain("Payable à réception");
    expect(messageFacture({ ...inv, due: 100, echeance: "2026-11-18" }, "Julie")).toContain("Reste à payer : 100,00 €, avant le 18 novembre 2026.");
  });
});

describe("la pièce jointe", () => {
  it("« Je vous joins la facture en PDF » seulement par e-mail ou avec le partage du téléphone", () => {
    expect(messageFacture(inv, "Julie", { canal: "email" })).toContain("Je vous joins la facture en PDF.");
    expect(messageFacture(inv, "Julie", { canal: "partage" })).toContain("Je vous joins la facture en PDF.");
    expect(messageFacture(inv, "Julie", { canal: "partage", tu: true })).toContain("Je te joins la facture en PDF.");
  });
  it("par SMS et WhatsApp, rien n'est joint : le message ne le promet pas", () => {
    const m = messageFacture(inv, "Julie", { canal: "court" });
    expect(m).not.toMatch(/joins/);
    expect(m).toContain("Je peux vous l’envoyer en PDF si besoin.");
    const a = messageFacture({ ...inv, kind: "avoir", totalTTC: -50, due: 0, avoirDe: { number: "2026-0001", issuedAt: "2026-10-05" } }, "Julie", { canal: "court", tu: true });
    expect(a).not.toMatch(/joins/);
    expect(a).toContain("Je peux te l’envoyer en PDF si besoin.");
  });
});

describe("la facture en PDF, faite sur le téléphone", () => {
  const contenu: NonNullable<Brouillon["facture"]> = {
    payer: "Claire D.",
    month: "2026-10",
    buyer: { name: "Claire Dubois", address: "3 allée des Saules\n72000 Le Mans" },
    franchise: true,
    lines: [
      { label: "Pension (Belle)", kind: "pension", qty: 1, rate: 0, unitTTC: 400, unitHT: 400, totalTTC: 400, totalHT: 400 },
      { label: "Cours collectif", kind: "cours", qty: 4, rate: 0, unitTTC: 23.7, unitHT: 23.7, totalTTC: 94.8, totalHT: 94.8 },
    ],
    totalHT: 494.8,
    vat: [{ rate: 0, base: 494.8, amount: 0 }],
    totalTTC: 494.8,
    paid: 94.8,
    due: 400,
    revenueIds: ["r1"],
  };
  const f = emettre({ invoices: [], invoiceSeq: {}, billing: { statut: "ei", nomPrenom: "Julie Martin", legalName: "Écurie des Prés", address: "1 rue du Pré", siret: "12345678900012", vat: "franchise", iban: "FR7630006000011234567890189" }, holding: {} }, contenu, "2026-10-19", "f1");

  it("est un vrai PDF d'une page A4", () => {
    const pdf = facturePdf(f);
    const txt = Buffer.from(pdf).toString("latin1");
    expect(txt.startsWith("%PDF-1.4")).toBe(true);
    expect(txt.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(txt).toContain("/MediaBox [0 0 595.28 841.89]");
    expect(txt).toContain("/Count 1");
    // La table des renvois pointe au bon octet.
    const xref = Number(/startxref\n(\d+)/.exec(txt)![1]);
    expect(txt.slice(xref, xref + 4)).toBe("xref");
  });

  it.skipIf(!process.env.BS_PDF_SORTIE)("écrit le PDF pour le regarder (BS_PDF_SORTIE=dossier)", () => {
    writeFileSync(join(process.env.BS_PDF_SORTIE!, "facture.pdf"), facturePdf(f));
  });

  it("dit ce que dit la feuille imprimée (lu avec pdftotext quand il est là)", () => {
    let texte: string;
    try {
      const dir = mkdtempSync(join(tmpdir(), "bs-pdf-"));
      const file = join(dir, "f.pdf");
      writeFileSync(file, facturePdf(f));
      texte = execFileSync("pdftotext", ["-layout", file, "-"]).toString();
    } catch {
      return; // pas de poppler sur cette machine : le test d'impression le vérifie aussi
    }
    for (const t of ["Julie Martin EI", "Écurie des Prés", "SIRET 123 456 789 00012", "Facture", "n° 2026-0001", "19 octobre 2026", "Prestations d’octobre 2026", "Claire Dubois", "Pension (Belle)", "Cours collectif", "94,80 €", "Reste à payer", "400,00 €", "TVA non applicable, art. 293 B du CGI", "IBAN FR76 3000 6000 0112 3456 7890 189"]) expect(texte).toContain(t);
  });

  it("une facture provisoire le dit, sans numéro", () => {
    const txt = Buffer.from(facturePdf(rendreProvisoire(f, "2026-10-19T10:00:00Z"))).toString("latin1");
    expect(txt).toContain("Facture provisoire, sans num\xe9ro");
    expect(txt).not.toContain("2026-0001");
  });

  it("un nom de fichier propre, des lignes coupées à la bonne largeur", () => {
    expect(nomFichierPdf(f)).toBe("Facture 2026-0001 Claire D.pdf");
    expect(nomFichierPdf({ ...f, payer: "A/B: C" })).toBe("Facture 2026-0001 A-B- C.pdf");
    expect(largeur("000", 10)).toBeCloseTo(16.68);
    const l = couper("Pension travail du cheval avec sorties au paddock tous les jours", 9.5, 120);
    expect(l.length).toBeGreaterThan(1);
    for (const x of l) expect(largeur(x, 9.5)).toBeLessThanOrEqual(120);
  });
});
