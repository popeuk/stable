import type { Period, StableData } from "@/lib/domain/types";
import {
  horseMarginSeries,
  horsePnl,
  horseVolatility,
  stablePnl,
} from "@/lib/domain/calculations";
import { addMonths, periodKey } from "@/lib/utils/period";
import { formatEur } from "@/lib/utils/format-currency";

export type InsightType =
  | "crossing_below"
  | "crossing_above"
  | "lowest_margin"
  | "highest_volatility"
  | "shared_expense_impact"
  | "vs_last_year";

export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  body: string;
  keyMetricValue: number;
  keyMetricLabel: string;
  relatedHorseId?: string;
  score: number;
  cta?: { label: string; action: string };
}

/**
 * Rule-based weekly insight generator (section 11.1). Each rule produces
 * candidate insights scored on economic impact and non-obviousness; the
 * caller keeps the highest-scoring one.
 *
 * In production the title/body strings would be rewritten by Claude; here
 * they are templated deterministically so the engine is testable offline.
 */
export function generateInsights(
  data: StableData,
  period: Period,
): Insight[] {
  const candidates: Insight[] = [];
  candidates.push(...ruleHorseCrossingThreshold(data, period));
  candidates.push(...ruleHorseLowestMargin(data, period));
  candidates.push(...ruleHorseHighestVolatility(data, period));
  candidates.push(...ruleSharedExpenseImpact(data, period));
  candidates.push(...ruleVsLastYear(data, period));
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

export function bestInsight(
  data: StableData,
  period: Period,
): Insight | null {
  return generateInsights(data, period)[0] ?? null;
}

const activeHorses = (data: StableData) =>
  data.horses.filter((h) => !h.isArchived);

function ruleHorseCrossingThreshold(
  data: StableData,
  period: Period,
): Insight[] {
  const out: Insight[] = [];
  for (const horse of activeHorses(data)) {
    const series = horseMarginSeries(data, horse.id, period, 2);
    if (series.length < 2) continue;
    const prev = series[0];
    const cur = horsePnl(data, horse.id, period);
    if (prev >= 0 && cur.netResult < 0) {
      const gap = Math.abs(cur.netResult);
      out.push({
        id: `crossing_below-${horse.id}-${periodKey(period)}`,
        type: "crossing_below",
        title: `${horse.name} est passé sous son seuil`,
        body: `Sa marge ne couvre plus son coût de place ce mois. Il manque ${formatEur(gap)} pour le remettre à l'équilibre.`,
        keyMetricValue: gap,
        keyMetricLabel: "à combler",
        relatedHorseId: horse.id,
        score: gap * 1.5,
        cta: {
          label: "Tester un scénario",
          action: `/scenarios/nouveau?horse=${horse.id}`,
        },
      });
    } else if (prev < 0 && cur.netResult >= 0) {
      out.push({
        id: `crossing_above-${horse.id}-${periodKey(period)}`,
        type: "crossing_above",
        title: `${horse.name} repasse au-dessus de son seuil`,
        body: `Après une période en perte, ${horse.name} couvre de nouveau ses coûts ce mois.`,
        keyMetricValue: cur.netResult,
        keyMetricLabel: "de marge nette",
        relatedHorseId: horse.id,
        score: cur.netResult * 1.2,
        cta: { label: "Voir le cheval", action: `/cheval?id=${horse.id}` },
      });
    }
  }
  return out;
}

function ruleHorseLowestMargin(
  data: StableData,
  period: Period,
): Insight[] {
  const horses = activeHorses(data);
  if (horses.length === 0) return [];
  const pnls = horses.map((h) => horsePnl(data, h.id, period));
  const worst = pnls.reduce((a, b) => (b.netResult < a.netResult ? b : a));
  if (worst.netResult >= 0) return [];
  const horse = horses.find((h) => h.id === worst.horseId)!;
  const gap = Math.abs(worst.netResult);
  return [
    {
      id: `lowest_margin-${horse.id}-${periodKey(period)}`,
      type: "lowest_margin",
      title: `${horse.name} pèse le plus sur ton résultat`,
      body: `C'est le cheval le moins rentable ce mois, avec ${formatEur(worst.netResult)} de résultat net.`,
      keyMetricValue: worst.netResult,
      keyMetricLabel: "résultat net",
      relatedHorseId: horse.id,
      score: gap * 1.0,
      cta: { label: "Voir le cheval", action: `/cheval?id=${horse.id}` },
    },
  ];
}

function ruleHorseHighestVolatility(
  data: StableData,
  period: Period,
): Insight[] {
  const horses = activeHorses(data);
  if (horses.length === 0) return [];
  const scored = horses.map((h) => ({
    horse: h,
    vol: horseVolatility(data, h.id, period, 6),
  }));
  const top = scored.reduce((a, b) => (b.vol > a.vol ? b : a));
  if (top.vol <= 0) return [];
  return [
    {
      id: `highest_volatility-${top.horse.id}-${periodKey(period)}`,
      type: "highest_volatility",
      title: `${top.horse.name} est ton cheval le plus imprévisible`,
      body: `Sa marge varie fortement d'un mois à l'autre (±${formatEur(top.vol)}). Un revenu plus régulier le stabiliserait.`,
      keyMetricValue: top.vol,
      keyMetricLabel: "d'écart-type mensuel",
      relatedHorseId: top.horse.id,
      score: top.vol * 0.6,
      cta: { label: "Voir le cheval", action: `/cheval?id=${top.horse.id}` },
    },
  ];
}

function ruleSharedExpenseImpact(
  data: StableData,
  period: Period,
): Insight[] {
  const month = data.sharedExpenses.filter(
    (s) => s.periodYear === period.year && s.periodMonth === period.month,
  );
  if (month.length === 0) return [];
  const heaviest = month.reduce((a, b) =>
    b.totalAmount > a.totalAmount ? b : a,
  );
  const total = stablePnl(data, period);
  const sharedTotal = month.reduce((s, m) => s + m.totalAmount, 0);
  return [
    {
      id: `shared_expense_impact-${heaviest.id}-${periodKey(period)}`,
      type: "shared_expense_impact",
      title: `Le poste « ${heaviest.label} » pèse lourd ce mois`,
      body: `${formatEur(heaviest.totalAmount)} répartis sur ton écurie, soit la plus grosse charge mutualisée du mois. Total mutualisé : ${formatEur(sharedTotal)}.`,
      keyMetricValue: heaviest.totalAmount,
      keyMetricLabel: heaviest.label,
      score: heaviest.totalAmount * 0.4 + (total.sharedCosts > 0 ? 50 : 0),
    },
  ];
}

function ruleVsLastYear(data: StableData, period: Period): Insight[] {
  const lastYear = addMonths(period, -12);
  const now = stablePnl(data, period);
  const then = stablePnl(data, lastYear);
  if (then.revenue === 0 && now.revenue === 0) return [];
  const delta = now.netResult - then.netResult;
  if (Math.abs(delta) < 1) return [];
  const up = delta > 0;
  return [
    {
      id: `vs_last_year-${periodKey(period)}`,
      type: "vs_last_year",
      title: up
        ? "Tu fais mieux que l'an dernier"
        : "Tu fais moins bien que l'an dernier",
      body: `À la même période l'an passé, ton résultat était de ${formatEur(then.netResult)}. Cette année : ${formatEur(now.netResult)}.`,
      keyMetricValue: delta,
      keyMetricLabel: up ? "de mieux" : "de moins",
      score: Math.abs(delta) * 0.5,
    },
  ];
}
