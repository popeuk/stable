import type { Period, StableData } from "@/lib/domain/types";
import { horsePnl, horseTrend, stablePnl, expenseBreakdown } from "@/lib/domain/calculations";
import { periodKey } from "@/lib/utils/period";
import { formatEur } from "@/lib/utils/format-currency";

export type RecoType =
  | "raise_pension"
  | "cut_cost"
  | "review_horse"
  | "index_pensions";

export interface Recommendation {
  id: string;
  type: RecoType;
  /** Short imperative — what to do. */
  title: string;
  /** Why, in plain language, with numbers. */
  why: string;
  /** Expected gain in € per month (0 when not quantifiable). */
  expectedImpact: number;
  relatedHorseId?: string;
  costPost?: string;
  /** Optional concept to learn behind this action. */
  lessonKey?: string;
  /** Link to test it in the simulator. */
  scenarioHref?: string;
}

/**
 * Turn the numbers into a short list of concrete, quantified actions — the
 * difference between observing and coaching. Sorted by expected € impact.
 */
export function generateRecommendations(data: StableData, period: Period): Recommendation[] {
  const pk = periodKey(period);
  const recos: Recommendation[] = [];
  const active = data.horses.filter((h) => !h.isArchived);

  // 1) Raise the pension of the horse furthest below its break-even.
  const underThreshold = active
    .map((h) => ({ horse: h, p: horsePnl(data, h.id, period) }))
    .filter((x) => x.p.netResult < 0)
    .sort((a, b) => a.p.netResult - b.p.netResult);
  if (underThreshold[0]) {
    const { horse, p } = underThreshold[0];
    const gap = Math.abs(p.netResult);
    recos.push({
      id: `raise_pension-${horse.id}-${pk}`,
      type: "raise_pension",
      title: `Augmente la pension de ${horse.name} de ${formatEur(gap)}`,
      why: `${horse.name} rapporte ${formatEur(p.revenue)} mais coûte ${formatEur(p.threshold)} : il te manque ${formatEur(gap)} chaque mois pour qu'il couvre sa place.`,
      expectedImpact: gap,
      relatedHorseId: horse.id,
      lessonKey: "seuil_rentabilite",
      scenarioHref: `/scenarios/nouveau?horse=${horse.id}`,
    });
  }

  // 2) Trim the heaviest cost post by 10%.
  const breakdown = expenseBreakdown(data, [period]);
  const biggest = breakdown[0];
  if (biggest && biggest.amount > 0) {
    const impact = Math.round(biggest.amount * 0.1);
    recos.push({
      id: `cut_cost-${biggest.label}-${pk}`,
      type: "cut_cost",
      title: `Vise −10 % sur « ${biggest.label} »`,
      why: `« ${biggest.label} » est ton plus gros poste : ${formatEur(biggest.amount)} (${Math.round(biggest.share * 100)} % de tes charges). En grignoter 10 %, c'est ${formatEur(impact)} de plus chaque mois.`,
      expectedImpact: impact,
      costPost: biggest.label,
      lessonKey: "depenses",
    });
  }

  // 3) Index the pensions when the overall margin is thin.
  const s = stablePnl(data, period);
  const margin = s.revenue ? (s.netResult / s.revenue) * 100 : 0;
  if (s.revenue > 0 && margin < 25) {
    const impact = Math.round(s.revenue * 0.05);
    recos.push({
      id: `index_pensions-${pk}`,
      type: "index_pensions",
      title: "Indexe tes pensions de 5 %",
      why: `Ta rentabilité est de ${Math.round(margin)} %. Une hausse de 5 % de tes pensions, c'est environ ${formatEur(impact)} de plus chaque mois — sans un cheval de plus.`,
      expectedImpact: impact,
      lessonKey: "pension_indexee",
      scenarioHref: `/scenarios/nouveau`,
    });
  }

  // 4) Look into a horse whose margin is sliding (not already flagged above).
  const flagged = new Set(underThreshold.map((x) => x.horse.id));
  const declining = active.find((h) => !flagged.has(h.id) && horseTrend(data, h.id, period) === "baisse");
  if (declining) {
    recos.push({
      id: `review_horse-${declining.id}-${pk}`,
      type: "review_horse",
      title: `Regarde ${declining.name} de près`,
      why: `La marge de ${declining.name} baisse depuis trois mois. Vérifie si c'est ponctuel (un véto) ou structurel, avant que ça pèse.`,
      expectedImpact: 0,
      relatedHorseId: declining.id,
      lessonKey: "tendance",
    });
  }

  return recos.sort((a, b) => b.expectedImpact - a.expectedImpact);
}
