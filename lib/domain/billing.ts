import type { Period, StableData } from "@/lib/domain/types";
import { dateInPeriod } from "@/lib/utils/period";

/**
 * Ce qu'il faut facturer, personne par personne, pour un mois (le décompte
 * du planning du Clos, élargi) : la pension, les séances faites, les soins
 * refacturés. Le payeur d'une recette est noté sur elle ; à défaut, c'est
 * le propriétaire du cheval. Domaine pur.
 */
export interface BillLine {
  label: string;
  horse?: string;
  amount: number;
  date: string;
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
    const horse = data.horses.find((h) => h.id === r.horseId);
    const payer = r.payer ?? horse?.ownerName ?? "Sans propriétaire";
    const person = data.people?.find((p) => p.name === payer);
    const role = person?.role ?? (owners.has(payer) ? "proprietaire" : "cavalier");
    const b = map.get(payer) ?? { payer, role, lines: [], total: 0, paid: 0, due: 0 };
    b.lines.push({ label: r.note || catName(r.categoryId) || "Recette", horse: horse?.name, amount: r.amount, date: r.date });
    b.total += r.amount;
    map.set(payer, b);
  }
  const mk = monthKey(period);
  for (const p of data.payments ?? []) {
    if (p.month !== mk) continue;
    const b = map.get(p.payer);
    if (b) b.paid += p.amount;
  }
  for (const b of map.values()) {
    b.total = Math.round(b.total * 100) / 100;
    b.due = Math.max(0, Math.round((b.total - b.paid) * 100) / 100);
  }
  return [...map.values()].sort((a, b) => b.due - a.due || a.payer.localeCompare(b.payer));
}
