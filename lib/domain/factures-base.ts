import type { Invoice, StableData } from "@/lib/domain/types";
import { cleClient } from "@/lib/domain/billing";
import { pensionRevenueId } from "@/lib/domain/autopilot";

/**
 * Ce que le carnet lit des factures à chaque instant (numéros, recettes déjà
 * facturées, fusion de deux carnets) : à part de facture.ts, qui compose et
 * émet, pour que l'accueil ne charge pas tout le métier des factures.
 * facture.ts redonne tout ceci : l'importer de l'un ou de l'autre revient au même.
 */

/**
 * Le prochain numéro de l'année : après le plus grand jamais donné, jamais un
 * numéro réutilisé. Trois mémoires comptent : les factures du carnet, le
 * compteur du carnet (`invoiceSeq`), et le compteur de l'appareil (`haut`),
 * qu'une sauvegarde reprise ne fait pas reculer.
 */
export function prochainNumero(
  invoices: Pick<Invoice, "year" | "seq">[] | undefined,
  seqs: Record<string, number> | undefined,
  year: number,
  haut?: Record<string, number>,
): { seq: number; number: string } {
  const y = String(year);
  const last = Math.max(seqs?.[y] ?? 0, haut?.[y] ?? 0, ...(invoices ?? []).filter((i) => i.year === year).map((i) => i.seq), 0);
  const seq = last + 1;
  return { seq, number: `${year}-${String(seq).padStart(4, "0")}` };
}

/** Le plus grand numéro de chaque année, entre plusieurs compteurs. */
export function compteurMax(...cs: (Record<string, number> | undefined)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cs) for (const [y, n] of Object.entries(c ?? {})) if (typeof n === "number" && n > (out[y] ?? 0)) out[y] = n;
  return out;
}

/**
 * Deux carnets de factures réunis (une sauvegarde reprise, un autre onglet) :
 * aucune facture ne se perd, le compteur garde le plus grand numéro. Une
 * facture se reconnaît à son id.
 */
export function fusionFactures(
  a: Pick<StableData, "invoices" | "invoiceSeq">,
  b: Pick<StableData, "invoices" | "invoiceSeq">,
  haut?: Record<string, number>,
): { invoices: Invoice[]; invoiceSeq: Record<string, number> } {
  const byId = new Map<string, Invoice>();
  for (const i of [...(a.invoices ?? []), ...(b.invoices ?? [])]) if (i?.id && !byId.has(i.id)) byId.set(i.id, i);
  const invoices = [...byId.values()].sort((x, y) => x.year - y.year || x.seq - y.seq);
  const fromInv: Record<string, number> = {};
  for (const i of invoices) fromInv[String(i.year)] = Math.max(fromInv[String(i.year)] ?? 0, i.seq);
  return { invoices, invoiceSeq: compteurMax(a.invoiceSeq, b.invoiceSeq, haut, fromInv) };
}

/** Un avoir, et non une facture. */
export const estAvoir = (i: Pick<Invoice, "kind">) => i.kind === "avoir";

/**
 * Les recettes encore facturées : sur une facture, et pas rendues par un
 * avoir. Une recette annulée par un avoir peut repasser sur une facture.
 */
export function recettesFacturees(invoices: Invoice[] | undefined): Map<string, string> {
  const n = new Map<string, number>();
  const ou = new Map<string, string>();
  for (const i of invoices ?? []) {
    for (const id of i.revenueIds) {
      n.set(id, (n.get(id) ?? 0) + (estAvoir(i) ? -1 : 1));
      if (!estAvoir(i)) ou.set(id, i.number);
    }
  }
  const out = new Map<string, string>();
  for (const [id, c] of n) if (c > 0 && ou.has(id)) out.set(id, ou.get(id)!);
  return out;
}

/** Les recettes rendues par un avoir et sur aucune facture en cours. */
export function recettesAnnulees(invoices: Invoice[] | undefined): Set<string> {
  const n = new Map<string, number>();
  for (const i of invoices ?? []) for (const id of i.revenueIds) n.set(id, (n.get(id) ?? 0) + (estAvoir(i) ? -1 : 1));
  return new Set([...n].filter(([, c]) => c <= 0).map(([id]) => id));
}

/** La fiche du client, casse et espaces confondus. */
export const personneDe = (data: Pick<StableData, "people">, payer: string) => (data.people ?? []).find((p) => cleClient(p.name) === cleClient(payer));

/**
 * La pension d'un cheval pour un mois garde-t-elle son prix quand on le
 * change ? « facturee » : elle est sur une facture (un avoir la corrige) ;
 * « partagee » : le propriétaire a changé en cours de mois, elle est en deux
 * parts (proprio.ts, partPension). Sinon null : le nouveau prix compte dès
 * ce mois.
 */
export function pensionFigee(data: Pick<StableData, "invoices" | "revenues">, horseId: string, mk: string): "facturee" | "partagee" | null {
  const rid = pensionRevenueId(horseId, mk);
  if (data.revenues.some((r) => r.id === `${rid}-suite`)) return "partagee";
  return recettesFacturees(data.invoices).has(rid) ? "facturee" : null;
}
