import type { Invoice } from "@/lib/domain/types";
import { mentionTvaDe, dateDite, deMois, enteteVendeur, eur2, mentionIban, mentionsPaiement, siretDit, tauxDit, tvaIntraDit } from "@/lib/domain/facture";
import { MENTION_PROVISOIRE } from "@/lib/domain/numeros";

/**
 * La facture (ou l'avoir) en PDF, fabriquée sur l'appareil, pour la joindre
 * au message quand le téléphone sait partager un fichier (navigator.share).
 * Le même contenu que la feuille imprimée (components/bs/feuille-facture.tsx),
 * en A4 portrait, polices standard du PDF (Helvetica), sans rien télécharger.
 * Domaine pur : rend les octets du fichier.
 */

const W = 595.28;
const H = 841.89;
const M = 42;

/* ---------- Le texte en WinAnsi (l'encodage des polices standard) ---------- */

const SPECIAUX: Record<string, number> = { "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "Œ": 0x8c, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "\u2014": 0x97, "œ": 0x9c, "Ÿ": 0x9f };
const REMPLACE: Record<string, string> = { "−": "-", " ": " ", " ": " ", " ": " " };

/** Un caractère en un octet WinAnsi (« ? » s'il n'existe pas dans la police). */
function octet(c: string): number {
  const r = REMPLACE[c];
  if (r) return r.charCodeAt(0);
  const s = SPECIAUX[c];
  if (s) return s;
  const n = c.charCodeAt(0);
  if ((n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff)) return n;
  return 0x3f;
}
const winAnsi = (t: string) => Array.from(t, (c) => String.fromCharCode(octet(c))).join("");
const echappe = (t: string) => winAnsi(t).replace(/[\\()]/g, (c) => `\\${c}`);

/* ---------- Les largeurs (Helvetica, en millièmes) pour aligner à droite et couper les lignes ---------- */

// prettier-ignore
const ASCII = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const BASE: Record<string, string> = { à: "a", â: "a", ä: "a", á: "a", é: "e", è: "e", ê: "e", ë: "e", î: "i", ï: "i", ô: "o", ö: "o", ù: "u", û: "u", ü: "u", ç: "c", ÿ: "y", À: "A", Â: "A", É: "E", È: "E", Ê: "E", Î: "I", Ô: "O", Ù: "U", Ç: "C", œ: "o", Œ: "O" };
function largeur1(c: string): number {
  const r = REMPLACE[c] ?? c;
  const n = r.charCodeAt(0);
  if (n >= 32 && n <= 126) return ASCII[n - 32];
  if (BASE[r]) return largeur1(BASE[r]) + (r === "œ" ? 388 : r === "Œ" ? 222 : 0);
  if (r === "’" || r === "‘") return 222;
  if (r === "€") return 556;
  if (r === " ") return 278;
  if (r === "°") return 400;
  return 556;
}
/** La largeur d'un texte en points (le gras est un peu plus large). */
export function largeur(t: string, taille: number, gras = false): number {
  let w = 0;
  for (const c of t) w += largeur1(c);
  return (w * taille * (gras ? 1.06 : 1)) / 1000;
}

/** Coupe un texte en lignes qui tiennent dans `max` points. */
export function couper(t: string, taille: number, max: number, gras = false): string[] {
  const out: string[] = [];
  for (const para of t.split("\n")) {
    let ligne = "";
    for (const mot of para.split(/ +/)) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (ligne && largeur(essai, taille, gras) > max) {
        out.push(ligne);
        ligne = mot;
      } else ligne = essai;
    }
    out.push(ligne);
  }
  return out;
}

/* ---------- Les pages ---------- */

class Pages {
  pages: string[] = [""];
  y = H - M;
  get cur() {
    return this.pages.length - 1;
  }
  private add(op: string) {
    this.pages[this.cur] += `${op}\n`;
  }
  /** Assez de place pour `h` points, sinon une nouvelle page. */
  place(h: number) {
    if (this.y - h < M) {
      this.pages.push("");
      this.y = H - M;
    }
  }
  texte(t: string, x: number, y: number, taille: number, gras = false, aDroite = false) {
    const xx = aDroite ? x - largeur(t, taille, gras) : x;
    this.add(`BT /${gras ? "F2" : "F1"} ${taille} Tf ${xx.toFixed(2)} ${y.toFixed(2)} Td (${echappe(t)}) Tj ET`);
  }
  trait(x1: number, y1: number, x2: number, y2: number, epais = 0.6) {
    this.add(`${epais} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }
  /** Une ligne de texte à la position courante, puis on descend. */
  ligne(t: string, taille = 9.5, gras = false, x = M, interligne = 1.35) {
    this.place(taille * interligne);
    this.y -= taille * interligne;
    this.texte(t, x, this.y, taille, gras);
  }
}

/** Le fichier PDF : catalogue, pages, deux polices, un flux par page. */
function assembler(contenus: string[]): Uint8Array {
  const objets: string[] = [];
  const n = contenus.length;
  const pageIds = contenus.map((_, i) => 5 + i * 2);
  objets[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objets[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${n} >>`;
  objets[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objets[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  contenus.forEach((c, i) => {
    const p = pageIds[i];
    objets[p] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${p + 1} 0 R >>`;
    objets[p + 1] = `<< /Length ${c.length} >>\nstream\n${c}endstream`;
  });
  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const pos: number[] = [];
  for (let i = 1; i < objets.length; i++) {
    pos[i] = out.length;
    out += `${i} 0 obj\n${objets[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objets.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objets.length; i++) out += `${String(pos[i]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(out, (c) => c.charCodeAt(0) & 0xff);
}

/** La facture (ou l'avoir) en PDF, telle qu'elle est partie. */
export function facturePdf(inv: Invoice): Uint8Array {
  const p = new Pages();
  const f = inv.franchise;
  const avoir = inv.kind === "avoir";
  const entete = enteteVendeur(inv.seller);
  const droite = W - M;

  // Le vendeur, à gauche.
  const haut = p.y;
  p.ligne(entete.nom, 12, true, M, 1);
  for (const l of [entete.sous, entete.rcs, ...(inv.seller.address ?? "").split("\n"), inv.seller.siret ? `SIRET ${siretDit(inv.seller.siret)}` : "", !f && inv.seller.tvaIntra ? `N° TVA intracommunautaire ${tvaIntraDit(inv.seller.tvaIntra)}` : ""])
    if (l?.trim()) p.ligne(l.trim());
  const basVendeur = p.y;

  // Le document, à droite.
  let y = haut - 18;
  p.texte(avoir ? "Avoir" : "Facture", droite, y, 20, true, true);
  const id = [
    inv.provisoire ? "n° à venir" : `n° ${inv.number}`,
    `Date : ${dateDite(inv.issuedAt)}`,
    ...(avoir && inv.avoirDe ? [`Sur la facture n° ${inv.avoirDe.number} du ${dateDite(inv.avoirDe.issuedAt)}`] : []),
    `Prestations ${deMois(inv.month)}`,
    ...(inv.provisoire ? [MENTION_PROVISOIRE] : []),
  ];
  for (const l of id) {
    y -= 13;
    p.texte(l, droite, y, 9.5, l === MENTION_PROVISOIRE, true);
  }
  p.y = Math.min(basVendeur, y) - 22;

  // Le client.
  p.ligne(avoir ? "Pour" : "Facturé à", 8.5);
  p.ligne(inv.buyer.name, 10.5, true);
  for (const l of (inv.buyer.address ?? "").split("\n")) if (l.trim()) p.ligne(l.trim());
  if (inv.buyer.tvaIntra) p.ligne(`N° TVA ${tvaIntraDit(inv.buyer.tvaIntra)}`);
  p.y -= 18;

  // Le tableau.
  const cols = f ? [droite - 190, droite - 95, droite] : [droite - 250, droite - 165, droite - 95, droite];
  const tete = f ? ["Qté", "Prix unitaire", "Total"] : ["Qté", "Prix unitaire HT", "TVA", "Total HT"];
  const larg = cols[0] - 30 - M;
  p.place(30);
  p.y -= 12;
  p.texte("Désignation", M, p.y, 8.5, true);
  tete.forEach((t, i) => p.texte(t, cols[i], p.y, 8.5, true, true));
  p.y -= 6;
  p.trait(M, p.y, droite, p.y);
  for (const l of inv.lines) {
    const lignes = couper(l.label, 9.5, larg);
    p.place(lignes.length * 13 + 6);
    p.y -= 14;
    const yl = p.y;
    lignes.forEach((t, k) => p.texte(t, M, yl - k * 12, 9.5));
    const vals = f ? [String(l.qty), eur2(l.unitHT), eur2(l.totalHT)] : [String(l.qty), eur2(l.unitHT), tauxDit(l.rate), eur2(l.totalHT)];
    vals.forEach((v, i) => p.texte(v, cols[i], yl, 9.5, false, true));
    p.y = yl - (lignes.length - 1) * 12 - 5;
    p.trait(M, p.y, droite, p.y, 0.3);
  }
  p.y -= 10;

  // Les totaux, à droite.
  const tot: [string, string, boolean][] = [];
  if (!f) {
    tot.push(["Total HT", eur2(inv.totalHT), false]);
    for (const v of inv.vat) tot.push([`TVA ${tauxDit(v.rate)} sur ${eur2(v.base)}`, eur2(v.amount), false]);
  }
  tot.push([avoir ? (f ? "Total de l’avoir" : "Total de l’avoir TTC") : f ? "Total" : "Total TTC", eur2(inv.totalTTC), true]);
  if (!avoir && inv.paid > 0) tot.push(["Déjà payé", eur2(inv.paid), false]);
  if (!avoir && (inv.avance ?? 0) > 0) tot.push(["Avance déjà versée", `−${eur2(inv.avance!)}`, false]);
  if (!avoir) tot.push(["Reste à payer", eur2(inv.due), true]);
  p.place(tot.length * 15 + 10);
  for (const [l, v, g] of tot) {
    p.y -= 15;
    p.texte(l, droite - 230, p.y, 10, g);
    p.texte(v, droite, p.y, 10, g, true);
  }
  p.y -= 24;

  // Les mentions, en bas.
  const pied = [...(mentionTvaDe(inv) ? [`${mentionTvaDe(inv)}.`] : []), ...mentionsPaiement(inv), ...(avoir ? [] : [mentionIban(inv.seller.iban)].filter(Boolean).map((m) => `${m}.`))];
  for (const m of pied) for (const l of couper(m, 8.5, droite - M)) p.ligne(l, 8.5);

  return assembler(p.pages);
}

/** « Facture 2026-0004 Claire D.pdf » : un nom de fichier sans caractère qui gêne. */
export function nomFichierPdf(inv: Pick<Invoice, "kind" | "number" | "payer" | "provisoire">): string {
  const doc = inv.provisoire ? "Facture provisoire" : `${inv.kind === "avoir" ? "Avoir" : "Facture"} ${inv.number}`;
  return `${`${doc} ${inv.payer}`.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim()}.pdf`;
}
