import type { Invoice } from "@/lib/domain/types";
import { prochainNumero } from "@/lib/domain/facture";

/**
 * Les factures « à numéroter » (question 18, réponse A de Samuel) : avec un
 * compte, une facture ne prend son numéro qu'après avoir relu la copie en
 * ligne, pour que le téléphone et l'ordinateur ne donnent jamais le même.
 * Sans réseau, elle est faite mais provisoire : elle se voit, s'imprime
 * avec « Facture provisoire, sans numéro », ne s'envoie pas, et reçoit son
 * numéro dès que le réseau revient, dans l'ordre où elles ont été faites.
 * Domaine pur.
 */

export const MENTION_PROVISOIRE = "Facture provisoire, sans numéro";

export const estProvisoire = (i: Pick<Invoice, "provisoire">) => !!i.provisoire;

/** Le numéro tel qu'il se dit : « 2026-0004 », ou « à numéroter ». */
export const numeroDit = (i: Pick<Invoice, "number" | "provisoire">) => (i.provisoire ? "à numéroter" : i.number);

/** L'adresse d'une facture : par son numéro, ou par son id tant qu'elle n'en a pas. */
export const lienFacture = (i: Pick<Invoice, "id" | "number" | "provisoire">) => (i.provisoire ? `/facture?id=${encodeURIComponent(i.id)}` : `/facture?n=${encodeURIComponent(i.number)}`);

/** Une facture faite sans réseau : pas de numéro (seq 0, qui ne compte pas dans la suite), l'heure où elle a été faite. */
export function rendreProvisoire(i: Invoice, faiteA: string): Invoice {
  return { ...i, number: `provisoire-${i.id}`, seq: 0, provisoire: faiteA };
}

const jours = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
const plus = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Donne leur numéro aux factures provisoires, dans l'ordre où elles ont été
 * faites, à la suite du plus grand numéro connu. Le numéro suit la date
 * d'émission : elles sont datées du jour où elles le reçoivent (l'échéance
 * d'un professionnel garde son délai). Rend toutes les factures et celles
 * qui viennent d'être numérotées.
 */
export function numeroterProvisoires(
  invoices: Invoice[],
  seqs: Record<string, number> | undefined,
  today: string,
  haut?: Record<string, number>,
): { invoices: Invoice[]; numerotees: Invoice[] } {
  const attente = invoices.filter(estProvisoire).sort((a, b) => a.provisoire!.localeCompare(b.provisoire!) || a.id.localeCompare(b.id));
  if (!attente.length) return { invoices, numerotees: [] };
  const year = Number(today.slice(0, 4));
  let acc = invoices.filter((i) => !estProvisoire(i));
  const numerotees: Invoice[] = [];
  for (const p of attente) {
    const { seq, number } = prochainNumero(acc, seqs, year, haut);
    const { provisoire: _p, ...reste } = p;
    void _p;
    const inv: Invoice = { ...reste, number, year, seq, issuedAt: today, ...(p.echeance ? { echeance: plus(today, jours(p.issuedAt, p.echeance)) } : {}) };
    acc = [...acc, inv];
    numerotees.push(inv);
  }
  const parId = new Map(numerotees.map((i) => [i.id, i]));
  return { invoices: invoices.map((i) => parId.get(i.id) ?? i), numerotees };
}

/**
 * Deux factures différentes qui portent le même numéro (faites en même temps
 * sur deux appareils, avant cette règle ou quand la relecture n'a pas pu tout
 * voir). Rend chaque numéro en double avec ses factures.
 */
export function numerosEnDouble(invoices: Invoice[] | undefined): { number: string; factures: Invoice[] }[] {
  const par = new Map<string, Invoice[]>();
  for (const i of invoices ?? []) if (!estProvisoire(i)) par.set(i.number, [...(par.get(i.number) ?? []), i]);
  return [...par.entries()].filter(([, fs]) => fs.length > 1).map(([number, factures]) => ({ number, factures }));
}
