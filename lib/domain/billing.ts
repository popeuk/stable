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
  role: "proprietaire" | "cavalier";
  lines: BillLine[];
  total: number;
  paid: number;
  due: number;
}

export function monthKey(p: Period): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

export function billsFor(data: StableData, period: Period): Bill[] {
  const map = new Map<string, Bill>();
  const owners = new Set(data.horses.map((h) => h.ownerName).filter(Boolean) as string[]);
  const catName = (id?: string) => data.revenueCategories.find((c) => c.id === id)?.name;
  for (const r of data.revenues) {
    if (!dateInPeriod(r.date, period)) continue;
    // L'argent hors chevaux (PAC, subvention) ne se facture à personne, sauf payeur nommé.
    if (!r.horseId && !r.payer) continue;
    const horse = data.horses.find((h) => h.id === r.horseId);
    const payer = r.payer ?? horse?.ownerName ?? "Sans propriétaire";
    const person = data.people?.find((p) => p.name === payer);
    const role = person?.role ?? (owners.has(payer) ? "proprietaire" : "cavalier");
    const b = map.get(payer) ?? { payer, role, lines: [], total: 0, paid: 0, due: 0 };
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
    map.set(payer, b);
  }
  const mk = monthKey(period);
  for (const p of data.payments ?? []) {
    if (p.month !== mk) continue;
    const b = map.get(p.payer);
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
  return [...map.values()].sort((a, b) => b.due - a.due || a.payer.localeCompare(b.payer));
}

/** Ce qu'un client doit ce mois-ci (0 s'il ne doit rien ou n'a rien eu). */
export function dueOf(data: StableData, payer: string, period: Period): number {
  return billsFor(data, period).find((b) => b.payer === payer)?.due ?? 0;
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
    const b = billsFor(data, p).find((x) => x.payer === payer);
    if (b && b.total > 0) out.push({ period: p, total: b.total, paid: Math.round(b.paid * 100) / 100, due: b.due });
  }
  return out;
}
