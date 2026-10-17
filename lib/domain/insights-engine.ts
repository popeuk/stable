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
        title: `${horse.name} te coûte de l’argent ce mois-ci`,
        body: `Le mois dernier, il rapportait autant qu’il coûtait. Ce mois-ci, il manque ${formatEur(gap)} pour couvrir ce qu’il coûte.`,
        keyMetricValue: gap,
        keyMetricLabel: "qui manquent",
        relatedHorseId: horse.id,
        score: gap * 1.5,
        cta: {
          label: "Et si… ?",
          action: `/scenarios/nouveau?horse=${horse.id}`,
        },
      });
    } else if (prev < 0 && cur.netResult >= 0) {
      out.push({
        id: `crossing_above-${horse.id}-${periodKey(period)}`,
        type: "crossing_above",
        title: `${horse.name} ne te coûte plus d’argent`,
        body: `Le mois dernier, il te coûtait plus qu’il ne rapportait. Ce mois-ci, ${horse.name} paie de nouveau tout ce qu’il coûte.`,
        keyMetricValue: cur.netResult,
        keyMetricLabel: "qu’il te laisse",
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
      title: `${horse.name} est le cheval qui te coûte le plus`,
      body: `Ce mois-ci, une fois tout payé, il te fait perdre ${formatEur(gap)}. C’est lui qu’il faut regarder en premier.`,
      keyMetricValue: worst.netResult,
      keyMetricLabel: "ce qu’il te laisse",
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
      title: `${top.horse.name} est le cheval le moins régulier`,
      body: `Ce qu’il te laisse change beaucoup d’un mois à l’autre (environ ${formatEur(top.vol)} d’écart). Un prix fixe chaque mois rendrait ses comptes plus prévisibles.`,
      keyMetricValue: top.vol,
      keyMetricLabel: "d’écart d’un mois à l’autre",
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
  // Le même total que Mon mois et Et si… : les factures du mois ET les
  // charges récurrentes partagées (assurance, crédit…).
  const sharedTotal = total.sharedCosts;
  return [
    {
      id: `shared_expense_impact-${heaviest.id}-${periodKey(period)}`,
      type: "shared_expense_impact",
      title: `« ${heaviest.label} » pèse le plus dans les frais de l’écurie ce mois-ci`,
      body: `${formatEur(heaviest.totalAmount)}, partagés entre tes chevaux. En tout, les frais de l’écurie (foin, paille, loyer, salaires…) font ${formatEur(sharedTotal)} ce mois-ci.`,
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
  // Pas de comparaison sans rien de noté l'an dernier : « il t'est resté 0 € » serait faux.
  const rienNote = then.revenue === 0 && then.directCosts === 0 && then.sharedCosts === 0;
  if (rienNote || (then.revenue === 0 && now.revenue === 0)) return [];
  const delta = now.netResult - then.netResult;
  if (Math.abs(delta) < 1) return [];
  const up = delta > 0;
  return [
    {
      id: `vs_last_year-${periodKey(period)}`,
      type: "vs_last_year",
      title: up
        ? "Il te reste plus que l’an dernier"
        : "Il te reste moins que l’an dernier",
      body: `Le même mois l’an dernier, il t’est resté ${formatEur(then.netResult)}. Cette année, ${formatEur(now.netResult)}.`,
      keyMetricValue: delta,
      keyMetricLabel: up ? "de mieux" : "de moins",
      score: Math.abs(delta) * 0.5,
    },
  ];
}
