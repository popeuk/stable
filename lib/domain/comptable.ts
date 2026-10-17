import type { Payment, RecurringExpense, StableData } from "@/lib/domain/types";
import { cleClient } from "@/lib/domain/billing";
import { KIND_LABEL, deMois, kindOf, recettesFacturees } from "@/lib/domain/facture";
import { moyenDit, nomMoyen } from "@/lib/domain/paiement";
import { recurringDue } from "@/lib/domain/recurring";
import { jourDuCheval, recurrenteDuCheval } from "@/lib/domain/presence";
import { daysInMonth, periodStart } from "@/lib/utils/period";

/**
 * Le tableau de l'année pour le comptable (centre de gestion) : une ligne
 * par recette, par dépense, par paiement reçu et par avoir. Fichier CSV au
 * format que lit Excel en France : séparateur point-virgule, UTF-8 avec BOM,
 * décimales à la virgule, dates JJ/MM/AAAA. Domaine pur.
 *
 * Chaque nature a sa colonne de montant : les recettes disent ce qui a été
 * vendu, les dépenses ce qui a été payé, les encaissements quand et comment
 * l'argent est rentré, les avoirs ce qui a été annulé sur une facture.
 * Chaque colonne s'additionne seule ; on n'ajoute pas les encaissements aux
 * recettes. Rien d'après aujourd'hui : les frais qui reviennent ne sont
 * comptés que pour les mois commencés.
 */

export const COLONNES = ["Date", "Nature", "Catégorie", "Libellé", "Cheval", "Client", "Recette TTC", "Dépense TTC", "Encaissement TTC", "Avoir TTC", "Moyen de paiement", "N° de facture"] as const;

export type Nature = "Recette" | "Dépense" | "Encaissement" | "Avoir";

export interface LigneComptable {
  date: string; // AAAA-MM-JJ
  type: Nature;
  categorie: string;
  libelle: string;
  cheval: string;
  client: string;
  /** Le montant, positif pour une recette, une dépense ou un encaissement ; négatif pour un avoir. */
  montant: number;
  moyen: string;
  facture: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
/** « 1234,5 » donne « 1234,50 » ; pas de séparateur de milliers (Excel le lit comme un nombre). */
export const nombreFr = (n: number) => r2(n).toFixed(2).replace(".", ",");
/** « 2026-10-03 » donne « 03/10/2026 ». */
export const dateFr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
/**
 * Une cellule de texte : un texte qui commence par = + - @, une tabulation
 * ou un retour chariot serait lu comme une formule par Excel ; il reçoit une
 * apostrophe devant. Puis entre guillemets s'il contient ; " ou un retour à
 * la ligne. Les montants ne passent pas par ici.
 */
export function cellule(v: string): string {
  const t = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** La date locale d'un paiement (son horodatage ISO), au jour. */
const jourDe = (p: Payment) => {
  if (!p.at) return `${p.month}-01`;
  const d = new Date(p.at);
  if (isNaN(d.getTime())) return p.at.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Ce qu'un frais connu à l'année compte un mois donné : le total de l'année
 * réparti au centime près, pour que les douze mois fassent exactement ce
 * que le gérant a tapé (1 000 € par an, et non 12 × 83,33 = 999,96 €).
 */
function partDuMois(re: RecurringExpense, month: number): number {
  if (!re.saisi || re.frequency !== "monthly") return re.amount;
  const an = re.saisi.mode === "an" ? re.saisi.montant : re.saisi.montant * Math.max(1, Math.min(12, Math.round(re.saisi.fois ?? 1)));
  if (!(an > 0)) return re.amount;
  return r2(Math.round((an * month * 100) / 12) / 100 - Math.round((an * (month - 1) * 100) / 12) / 100);
}

/**
 * Les lignes de l'année jusqu'à aujourd'hui compris (`today`, AAAA-MM-JJ) :
 * le comptable ne reçoit rien qui n'a pas encore eu lieu.
 */
export function lignesComptables(data: StableData, year: number, today: string): LigneComptable[] {
  const y = String(year);
  const horse = (id?: string) => data.horses.find((h) => h.id === id);
  const revCat = (id?: string) => data.revenueCategories.find((c) => c.id === id)?.name ?? "";
  const expCat = (id?: string) => data.expenseCategories.find((c) => c.id === id)?.name ?? "";
  const factureDe = recettesFacturees(data.invoices);
  const payments = data.payments ?? [];
  /** Le libellé n'est pas la catégorie répétée. */
  const libelleDe = (note: string | undefined, cat: string) => (note?.trim() && note.trim() !== cat ? note.trim() : "");

  // Le moyen d'une recette : celui du paiement sur place de sa séance, sinon
  // celui du mois du client quand tous ses paiements du mois disent le même.
  const moyenDuMois = new Map<string, string>();
  const parMois = new Map<string, Payment[]>();
  for (const p of payments) {
    if (p.seanceId) continue;
    const k = `${cleClient(p.payer)}|${p.month}`;
    parMois.set(k, [...(parMois.get(k) ?? []), p]);
  }
  for (const [k, ps] of parMois) {
    const ms = new Set(ps.map((p) => p.method ?? ""));
    if (ms.size === 1 && ps[0].method) moyenDuMois.set(k, nomMoyen(ps[0].method));
  }
  const moyenRecette = (client: string, month: string, seanceId?: string) => {
    if (seanceId) {
      const p = payments.find((x) => x.seanceId === seanceId && cleClient(x.payer) === cleClient(client));
      if (p) return nomMoyen(p.method);
    }
    return moyenDuMois.get(`${cleClient(client)}|${month}`) ?? "";
  };

  const out: LigneComptable[] = [];
  for (const r of data.revenues) {
    if (r.date.slice(0, 4) !== y) continue;
    const h = horse(r.horseId);
    const cat = revCat(r.categoryId) || KIND_LABEL[kindOf(r, revCat(r.categoryId))];
    const client = r.payer?.trim() || h?.ownerName?.trim() || "";
    out.push({
      date: r.date,
      type: "Recette",
      categorie: cat,
      libelle: libelleDe(r.note, cat),
      cheval: h?.name ?? "",
      client,
      montant: r.amount,
      moyen: client ? moyenRecette(client, r.date.slice(0, 7), r.seanceId) : "",
      facture: factureDe.get(r.id) ?? "",
    });
  }

  for (let m = 1; m <= 12; m++) {
    const p = { year, month: m };
    const start = periodStart(p);
    const jour = (startDate: string) => `${start.slice(0, 8)}${String(Math.min(Number(startDate.slice(8, 10)) || 1, daysInMonth(p))).padStart(2, "0")}`;
    for (const rr of data.recurringRevenues ?? []) {
      const h = horse(rr.horseId);
      // Les séjours du cheval : rien entre deux séjours, et le jour de son retour s'il revient en cours de mois.
      if (!recurringDue(rr, p) || (h && !recurrenteDuCheval(h, p))) continue;
      const cat = revCat(rr.categoryId) || "Pension";
      out.push({ date: h ? jourDuCheval(h, p, jour(rr.startDate)) : jour(rr.startDate), type: "Recette", categorie: cat, libelle: libelleDe(rr.label, cat), cheval: h?.name ?? "", client: h?.ownerName?.trim() ?? "", montant: rr.amount, moyen: "", facture: "" });
    }
    for (const re of data.recurringExpenses ?? []) {
      const h = horse(re.horseId);
      if (!recurringDue(re, p) || (!re.isShared && h && !recurrenteDuCheval(h, p))) continue;
      const cat = expCat(re.categoryId);
      out.push({ date: jour(re.startDate), type: "Dépense", categorie: cat, libelle: libelleDe(re.label, cat), cheval: re.isShared ? "commun" : (h?.name ?? ""), client: "", montant: partDuMois(re, m), moyen: "", facture: "" });
    }
  }

  for (const e of data.directExpenses) {
    if (e.date.slice(0, 4) !== y) continue;
    const cat = expCat(e.categoryId);
    out.push({ date: e.date, type: "Dépense", categorie: cat, libelle: libelleDe(e.label, cat), cheval: horse(e.horseId)?.name ?? "", client: "", montant: e.amount, moyen: "", facture: "" });
  }
  for (const s of data.sharedExpenses) {
    if (s.periodYear !== year) continue;
    const cat = expCat(s.categoryId);
    out.push({ date: `${y}-${String(s.periodMonth).padStart(2, "0")}-01`, type: "Dépense", categorie: cat, libelle: libelleDe(s.label, cat), cheval: "commun", client: "", montant: s.totalAmount, moyen: "", facture: "" });
  }

  for (const p of payments) {
    const d = jourDe(p);
    if (d.slice(0, 4) !== y) continue;
    const nums = (data.invoices ?? []).filter((i) => i.kind !== "avoir" && i.month === p.month && cleClient(i.payer) === cleClient(p.payer)).map((i) => i.number);
    out.push({
      date: d,
      type: "Encaissement",
      categorie: "Paiement reçu",
      libelle: p.seanceId ? "Payé sur place" : `Paiement ${deMois(p.month)}`,
      cheval: "",
      client: p.payer,
      montant: p.amount,
      moyen: moyenDit(p),
      facture: nums.join(", "),
    });
  }

  for (const a of data.invoices ?? []) {
    if (a.kind !== "avoir" || a.issuedAt.slice(0, 4) !== y) continue;
    out.push({
      date: a.issuedAt,
      type: "Avoir",
      categorie: "Avoir",
      libelle: a.avoirDe ? `Sur la facture n° ${a.avoirDe.number}` : "",
      cheval: "",
      client: a.payer,
      montant: a.totalTTC,
      moyen: "",
      facture: a.number,
    });
  }

  const ordre: Record<Nature, number> = { Recette: 0, Dépense: 1, Encaissement: 2, Avoir: 3 };
  return out.filter((l) => l.date <= today).sort((a, b) => a.date.localeCompare(b.date) || ordre[a.type] - ordre[b.type] || a.libelle.localeCompare(b.libelle, "fr"));
}

/** Le fichier CSV de l'année, BOM compris, lignes séparées par CRLF. Chaque montant dans la colonne de sa nature. */
export function csvComptable(data: StableData, year: number, today: string): string {
  const col: Record<Nature, number> = { Recette: 0, Dépense: 1, Encaissement: 2, Avoir: 3 };
  const rows = lignesComptables(data, year, today).map((l) => {
    const montants = ["", "", "", ""];
    montants[col[l.type]] = nombreFr(l.montant);
    return [...[dateFr(l.date), l.type, l.categorie, l.libelle, l.cheval, l.client].map(cellule), ...montants, ...[l.moyen, l.facture].map(cellule)].join(";");
  });
  return `﻿${[COLONNES.join(";"), ...rows].join("\r\n")}\r\n`;
}

/** Les années qui ont quelque chose à exporter, de la plus récente à la plus ancienne. */
export function anneesComptables(data: StableData, now: number): number[] {
  const ys = new Set<number>([now]);
  for (const r of data.revenues) ys.add(Number(r.date.slice(0, 4)));
  for (const e of data.directExpenses) ys.add(Number(e.date.slice(0, 4)));
  for (const s of data.sharedExpenses) ys.add(s.periodYear);
  return [...ys].filter((n) => n > 1990 && n <= now).sort((a, b) => b - a);
}
