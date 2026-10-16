import type { Period, StableData } from "@/lib/domain/types";
import { addMonths, dateInPeriod } from "@/lib/utils/period";

/**
 * Ce qu'il faut facturer, personne par personne, pour un mois (le décompte
 * du planning du Clos, élargi) : la pension, les séances faites, les soins
 * refacturés. Le payeur d'une recette est noté sur elle ; à défaut, c'est
 * le propriétaire du cheval. Domaine pur.
 */
export interface BillLine {
  /** L'id de la recette : c'est elle qu'on retire si la ligne n'a pas eu lieu. */
  id: string;
  label: string;
  horse?: string;
  horseId?: string;
  amount: number;
  date: string;
  /** La séance d'origine (cours, balade…). */
  seanceId?: string;
  /** Un soin refacturé : la dépense d'origine. */
  rebillOf?: string;
  /** Réglée sur place, à la séance. */
  onSite?: boolean;
}
export interface Bill {
  payer: string;
  /**
   * Les recettes de chevaux sans propriétaire : personne à qui les
   * facturer. Elles sont dites telles quelles, jamais comptées dans ce qui
   * reste à recevoir.
   */
  orphan?: boolean;
  role: "proprietaire" | "cavalier";
  lines: BillLine[];
  total: number;
  paid: number;
  due: number;
}

export function monthKey(p: Period): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

/** Le payeur des recettes d'un cheval sans propriétaire. */
export const SANS_PROPRIETAIRE = "Sans propriétaire";

/** Un même client, quelle que soit la casse ou les espaces (« hugo l. » = « Hugo L. »). */
export const cleClient = (n: string) => n.trim().replace(/\s+/g, " ").toLowerCase();

export function billsFor(data: StableData, period: Period): Bill[] {
  // Rangées par client, casse et espaces confondus : Facturer et Clients
  // donnent le même dû pour la même personne.
  const map = new Map<string, Bill>();
  const owners = new Set((data.horses.map((h) => h.ownerName).filter(Boolean) as string[]).map(cleClient));
  const nomDe = (n: string) => data.people?.find((p) => cleClient(p.name) === cleClient(n))?.name ?? n.trim();
  const catName = (id?: string) => data.revenueCategories.find((c) => c.id === id)?.name;
  for (const r of data.revenues) {
    if (!dateInPeriod(r.date, period)) continue;
    // L'argent hors chevaux (PAC, subvention) ne se facture à personne, sauf payeur nommé.
    if (!r.horseId && !r.payer) continue;
    const horse = data.horses.find((h) => h.id === r.horseId);
    const brut = r.payer?.trim() || horse?.ownerName?.trim();
    const orphan = !brut;
    const payer = orphan ? SANS_PROPRIETAIRE : nomDe(brut);
    const key = orphan ? "\u0000orphan" : cleClient(payer);
    const person = data.people?.find((p) => cleClient(p.name) === key);
    const role = orphan ? "proprietaire" : (person?.role ?? (owners.has(key) ? "proprietaire" : "cavalier"));
    const b = map.get(key) ?? { payer, role, lines: [], total: 0, paid: 0, due: 0, ...(orphan ? { orphan: true } : {}) };
    b.lines.push({
      id: r.id,
      label: r.note || catName(r.categoryId) || "Recette",
      horse: horse?.name,
      horseId: horse?.id,
      amount: r.amount,
      date: r.date,
      ...(r.seanceId ? { seanceId: r.seanceId } : {}),
      ...(r.rebillOf ? { rebillOf: r.rebillOf } : {}),
    });
    b.total += r.amount;
    map.set(key, b);
  }
  const mk = monthKey(period);
  for (const p of data.payments ?? []) {
    if (p.month !== mk) continue;
    const b = map.get(cleClient(p.payer));
    if (!b) continue;
    if (p.seanceId) {
      // Payé sur place : ne compte que si la séance est bien sur sa note du mois.
      const line = b.lines.find((l) => l.seanceId === p.seanceId && !l.onSite);
      if (!line) continue;
      line.onSite = true;
    }
    b.paid += p.amount;
  }
  for (const b of map.values()) {
    b.total = Math.round(b.total * 100) / 100;
    b.due = Math.max(0, Math.round((b.total - b.paid) * 100) / 100);
  }
  for (const b of map.values()) if (b.orphan) b.due = 0;
  return [...map.values()].sort((a, b) => Number(!!a.orphan) - Number(!!b.orphan) || b.due - a.due || a.payer.localeCompare(b.payer));
}

/** La note d'un client ce mois-ci (casse et espaces confondus), ou undefined. */
export function billOf(data: StableData, payer: string, period: Period): Bill | undefined {
  return billsFor(data, period).find((b) => !b.orphan && cleClient(b.payer) === cleClient(payer));
}

/** Ce qu'un client doit ce mois-ci (0 s'il ne doit rien ou n'a rien eu). */
export function dueOf(data: StableData, payer: string, period: Period): number {
  return billOf(data, payer, period)?.due ?? 0;
}

/**
 * Les totaux de Facturer : ce qui est à facturer à quelqu'un, reçu, encore
 * à recevoir. L'argent des chevaux sans propriétaire est à part
 * (`sansProprietaire`) : il n'y a personne à qui le demander.
 */
export function billTotals(bills: Bill[]) {
  const real = bills.filter((b) => !b.orphan);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const total = r2(real.reduce((t, b) => t + b.total, 0));
  const paid = r2(real.reduce((t, b) => t + Math.min(b.paid, b.total), 0));
  return { total, paid, due: r2(real.reduce((t, b) => t + b.due, 0)), sansProprietaire: r2(bills.filter((b) => b.orphan).reduce((t, b) => t + b.total, 0)) };
}

export interface MonthSummary {
  period: Period;
  total: number;
  paid: number;
  due: number;
}

/**
 * Les mois d'avant d'un client : pour chacun, ce qu'il y avait en tout et ce
 * qu'il a payé. Les mois vides sont sautés. Du plus récent au plus ancien.
 */
export function monthsBefore(data: StableData, payer: string, period: Period, count = 3, lookback = 12): MonthSummary[] {
  const out: MonthSummary[] = [];
  for (let k = 1; k <= lookback && out.length < count; k++) {
    const p = addMonths(period, -k);
    const b = billOf(data, payer, p);
    if (b && b.total > 0) out.push({ period: p, total: b.total, paid: Math.round(b.paid * 100) / 100, due: b.due });
  }
  return out;
}
