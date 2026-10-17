import type { Payment, StableData } from "@/lib/domain/types";
import { cleClient } from "@/lib/domain/billing";
import { KIND_LABEL, kindOf } from "@/lib/domain/facture";
import { moyenDit, nomMoyen } from "@/lib/domain/paiement";
import { recurringDue } from "@/lib/domain/recurring";
import { partiAvant } from "@/lib/domain/presence";
import { daysInMonth, periodStart } from "@/lib/utils/period";

/**
 * Le tableau de l'année pour le comptable (centre de gestion) : une ligne
 * par recette, par dépense et par paiement reçu. Fichier CSV au format que
 * lit Excel en France : séparateur point-virgule, UTF-8 avec BOM, décimales
 * à la virgule, dates JJ/MM/AAAA. Domaine pur.
 *
 * Les recettes disent ce qui a été vendu ; les encaissements disent quand
 * et comment l'argent est rentré. Les deux ne s'additionnent pas.
 */

export const COLONNES = ["Date", "Type", "Catégorie", "Libellé", "Cheval", "Client", "Montant TTC", "Moyen de paiement", "N° de facture"] as const;

export interface LigneComptable {
  date: string; // AAAA-MM-JJ
  type: "Recette" | "Dépense" | "Encaissement";
  categorie: string;
  libelle: string;
  cheval: string;
  client: string;
  montant: number;
  moyen: string;
  facture: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
/** « 1234,5 » donne « 1234,50 » ; pas de séparateur de milliers (Excel le lit comme un nombre). */
export const nombreFr = (n: number) => r2(n).toFixed(2).replace(".", ",");
/** « 2026-10-03 » donne « 03/10/2026 ». */
export const dateFr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
/** Une cellule : entre guillemets si elle contient ; " ou un retour à la ligne. */
export function cellule(v: string): string {
  return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** La date locale d'un paiement (son horodatage ISO), au jour. */
const jourDe = (p: Payment) => {
  if (!p.at) return `${p.month}-01`;
  const d = new Date(p.at);
  if (isNaN(d.getTime())) return p.at.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function lignesComptables(data: StableData, year: number): LigneComptable[] {
  const y = String(year);
  const horse = (id?: string) => data.horses.find((h) => h.id === id);
  const revCat = (id?: string) => data.revenueCategories.find((c) => c.id === id)?.name ?? "";
  const expCat = (id?: string) => data.expenseCategories.find((c) => c.id === id)?.name ?? "";
  const factureDe = new Map<string, string>();
  for (const inv of data.invoices ?? []) for (const id of inv.revenueIds) factureDe.set(id, inv.number);
  const payments = data.payments ?? [];

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
    const cat = revCat(r.categoryId);
    const client = r.payer?.trim() || h?.ownerName?.trim() || "";
    out.push({
      date: r.date,
      type: "Recette",
      categorie: cat || KIND_LABEL[kindOf(r, cat)],
      libelle: r.note || cat || "Recette",
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
      if (!recurringDue(rr, p) || (h && partiAvant(h, start))) continue;
      const cat = revCat(rr.categoryId);
      out.push({ date: jour(rr.startDate), type: "Recette", categorie: cat || "Pension", libelle: rr.label || cat || "Pension", cheval: h?.name ?? "", client: h?.ownerName?.trim() ?? "", montant: rr.amount, moyen: "", facture: "" });
    }
    for (const re of data.recurringExpenses ?? []) {
      const h = horse(re.horseId);
      if (!recurringDue(re, p) || (!re.isShared && h && partiAvant(h, start))) continue;
      out.push({ date: jour(re.startDate), type: "Dépense", categorie: expCat(re.categoryId), libelle: re.label, cheval: re.isShared ? "commun" : (h?.name ?? ""), client: "", montant: re.amount, moyen: "", facture: "" });
    }
  }

  for (const e of data.directExpenses) {
    if (e.date.slice(0, 4) !== y) continue;
    out.push({ date: e.date, type: "Dépense", categorie: expCat(e.categoryId), libelle: e.label, cheval: horse(e.horseId)?.name ?? "", client: "", montant: e.amount, moyen: "", facture: "" });
  }
  for (const s of data.sharedExpenses) {
    if (s.periodYear !== year) continue;
    out.push({ date: `${y}-${String(s.periodMonth).padStart(2, "0")}-01`, type: "Dépense", categorie: expCat(s.categoryId), libelle: s.label, cheval: "commun", client: "", montant: s.totalAmount, moyen: "", facture: "" });
  }

  for (const p of payments) {
    const d = jourDe(p);
    if (d.slice(0, 4) !== y) continue;
    const nums = (data.invoices ?? []).filter((i) => i.month === p.month && cleClient(i.payer) === cleClient(p.payer)).map((i) => i.number);
    out.push({
      date: d,
      type: "Encaissement",
      categorie: "Paiement reçu",
      libelle: p.seanceId ? "Payé sur place" : `Paiement de ${new Date(Number(p.month.slice(0, 4)), Number(p.month.slice(5, 7)) - 1, 15).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`,
      cheval: "",
      client: p.payer,
      montant: p.amount,
      moyen: moyenDit(p),
      facture: nums.join(", "),
    });
  }

  const ordre = { Recette: 0, Dépense: 1, Encaissement: 2 };
  return out.sort((a, b) => a.date.localeCompare(b.date) || ordre[a.type] - ordre[b.type] || a.libelle.localeCompare(b.libelle, "fr"));
}

/** Le fichier CSV de l'année, BOM compris, lignes séparées par CRLF. */
export function csvComptable(data: StableData, year: number): string {
  const rows = lignesComptables(data, year).map((l) => [dateFr(l.date), l.type, l.categorie, l.libelle, l.cheval, l.client, nombreFr(l.montant), l.moyen, l.facture].map(cellule).join(";"));
  return `﻿${[COLONNES.join(";"), ...rows].join("\r\n")}\r\n`;
}

/** Les années qui ont quelque chose à exporter, de la plus récente à la plus ancienne. */
export function anneesComptables(data: StableData, now: number): number[] {
  const ys = new Set<number>([now]);
  for (const r of data.revenues) ys.add(Number(r.date.slice(0, 4)));
  for (const e of data.directExpenses) ys.add(Number(e.date.slice(0, 4)));
  for (const s of data.sharedExpenses) ys.add(s.periodYear);
  return [...ys].filter((n) => n > 1990 && n <= now + 1).sort((a, b) => b - a);
}
