import type { Period, StableData } from "@/lib/domain/types";
import { horsePnl, horseSharedCosts, stablePnl } from "@/lib/domain/calculations";
import { dateInPeriod } from "@/lib/utils/period";
import { recurringList, recurringDue } from "@/lib/domain/recurring";

/**
 * Le ticket du mois d'un cheval, et le bilan du mois de l'écurie, dans la
 * forme que l'app montre : des lignes lisibles, un total. Les totaux
 * viennent des calculs existants (calculations.ts) : le ticket ne recalcule
 * rien, il range. Domaine pur, zéro framework.
 */

export interface TicketLine {
  key: string;
  label: string;
  /** Positif = ce qui rentre, négatif = ce qui sort. */
  amount: number;
  /** Identifiant de la ligne source (revenu, dépense) pour la retrouver. */
  sourceId?: string;
  date?: string;
  kind: "in" | "out" | "share";
}

export interface HorseTicket {
  horseId: string;
  lines: TicketLine[];
  revenue: number;
  direct: number;
  share: number;
  net: number;
}

function catName(data: StableData, id?: string): string | undefined {
  if (!id) return undefined;
  return (
    data.revenueCategories.find((c) => c.id === id)?.name ??
    data.expenseCategories.find((c) => c.id === id)?.name
  );
}

export function horseTicket(data: StableData, horseId: string, period: Period): HorseTicket {
  const lines: TicketLine[] = [];
  for (const r of data.revenues) {
    if (r.horseId !== horseId || !dateInPeriod(r.date, period)) continue;
    lines.push({
      key: r.id,
      sourceId: r.id,
      date: r.date,
      label: r.note || catName(data, r.categoryId) || "Recette",
      amount: r.amount,
      kind: "in",
    });
  }
  for (const rec of data.recurringRevenues ?? []) {
    if (rec.horseId !== horseId || !recurringDue(rec, period)) continue;
    lines.push({ key: rec.id, label: rec.label || catName(data, rec.categoryId) || "Recette", amount: rec.amount, kind: "in" });
  }
  for (const e of data.directExpenses) {
    if (e.horseId !== horseId || !dateInPeriod(e.date, period)) continue;
    lines.push({ key: e.id, sourceId: e.id, date: e.date, label: e.label, amount: -e.amount, kind: "out" });
  }
  for (const rec of recurringList(data)) {
    if (rec.isShared || rec.horseId !== horseId || !recurringDue(rec, period)) continue;
    lines.push({ key: rec.id, label: rec.label, amount: -rec.amount, kind: "out" });
  }
  const share = horseSharedCosts(data, horseId, period);
  if (share > 0) lines.push({ key: "share", label: "Part des frais communs", amount: -share, kind: "share" });

  // Ce qui rentre d'abord (pension en tête), puis ce qui sort, la part en dernier.
  lines.sort((a, b) => {
    const order = { in: 0, out: 1, share: 2 } as const;
    if (order[a.kind] !== order[b.kind]) return order[a.kind] - order[b.kind];
    if (a.kind === "in") return /pension/i.test(a.label) ? -1 : /pension/i.test(b.label) ? 1 : 0;
    return (a.date ?? "").localeCompare(b.date ?? "");
  });

  const p = horsePnl(data, horseId, period);
  return { horseId, lines, revenue: p.revenue, direct: p.directCosts, share: p.sharedCosts, net: p.netResult };
}

/**
 * Les résultats par cheval arrondis à l'euro, de sorte que leur somme tombe
 * exactement sur le résultat de l'écurie (méthode du plus fort reste) : un
 * gérant qui additionne les tickets retrouve le chiffre du mois.
 */
export function reconciledNets(data: StableData, period: Period): Record<string, number> {
  const s = stablePnl(data, period);
  const target = Math.round(s.netResult);
  const fl = s.perHorse.map((p) => ({ id: p.horseId, f: Math.floor(p.netResult), r: p.netResult - Math.floor(p.netResult) }));
  let left = target - fl.reduce((t, x) => t + x.f, 0);
  [...fl].sort((a, b) => b.r - a.r).forEach((x) => {
    if (left > 0) {
      x.f += 1;
      left -= 1;
    }
  });
  return Object.fromEntries(fl.map((x) => [x.id, x.f]));
}

export interface MonthLine {
  label: string;
  amount: number;
}

export interface MonthBreakdown {
  ins: MonthLine[];
  shared: MonthLine[];
  revenue: number;
  direct: number;
  sharedTotal: number;
  net: number;
  horseCount: number;
  /** Ce que laisse un cheval en moyenne, une fois ses soins payés. */
  contribution: number;
  /** Le nombre de chevaux qui paient les factures communes. */
  seuil: number;
}

export function monthBreakdown(data: StableData, period: Period): MonthBreakdown {
  const s = stablePnl(data, period);
  const active = new Set(data.horses.filter((h) => !h.isArchived).map((h) => h.id));

  const insMap = new Map<string, number>();
  const addIn = (label: string, a: number) => insMap.set(label, (insMap.get(label) ?? 0) + a);
  for (const r of data.revenues) {
    if (!active.has(r.horseId) || !dateInPeriod(r.date, period)) continue;
    addIn(catName(data, r.categoryId) ?? "Autres recettes", r.amount);
  }
  for (const rec of data.recurringRevenues ?? []) {
    if (!active.has(rec.horseId) || !recurringDue(rec, period)) continue;
    addIn(catName(data, rec.categoryId) ?? rec.label ?? "Autres recettes", rec.amount);
  }

  // Les factures communes, à hauteur de ce qui est réparti sur les chevaux présents.
  const shMap = new Map<string, number>();
  const addSh = (label: string, a: number) => shMap.set(label, (shMap.get(label) ?? 0) + a);
  for (const se of data.sharedExpenses) {
    if (se.periodYear !== period.year || se.periodMonth !== period.month) continue;
    const a = se.allocations.filter((x) => active.has(x.horseId)).reduce((t, x) => t + x.allocatedAmount, 0);
    if (a > 0) addSh(se.label, a);
  }
  // Les charges récurrentes partagées (assurance, crédit…), sous leur nom.
  if (active.size) {
    for (const r of recurringList(data)) {
      if (r.isShared && recurringDue(r, period)) addSh(r.label, r.amount);
    }
  }
  const listed = [...shMap.values()].reduce((t, a) => t + a, 0);
  const rest = Math.round((s.sharedCosts - listed) * 100) / 100;
  if (rest > 0.5) addSh("Autres charges communes", rest);

  const contribution = s.horseCount ? (s.revenue - s.directCosts) / s.horseCount : 0;
  const seuil = contribution > 0 ? s.sharedCosts / contribution : Infinity;

  const sortDesc = (m: Map<string, number>) =>
    [...m.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);

  return {
    ins: sortDesc(insMap),
    shared: sortDesc(shMap),
    revenue: s.revenue,
    direct: s.directCosts,
    sharedTotal: s.sharedCosts,
    net: s.netResult,
    horseCount: s.horseCount,
    contribution,
    seuil,
  };
}
