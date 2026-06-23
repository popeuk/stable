import type { Period, StableData } from "@/lib/domain/types";
import { stablePnl, expenseBreakdown } from "@/lib/domain/calculations";
import { generateRecommendations } from "@/lib/domain/recommendations";
import { recurringList } from "@/lib/domain/recurring";
import { dateInPeriod } from "@/lib/utils/period";
import { formatEur } from "@/lib/utils/format-currency";

export interface AdvisorTopic {
  key: string;
  question: string;
}

/** The questions the advisor can answer right now, from real data. */
export const ADVISOR_TOPICS: AdvisorTopic[] = [
  { key: "profitability", question: "Où en est ma rentabilité ?" },
  { key: "improve_margin", question: "Comment améliorer ma marge ?" },
  { key: "new_horse_price", question: "Quel tarif pour un nouveau cheval ?" },
  { key: "biggest_costs", question: "Où sont mes plus gros coûts ?" },
  { key: "fill_potential", question: "Combien je gagne en remplissant ?" },
  { key: "recurring", question: "Mes charges récurrentes ?" },
];

function avgPension(data: StableData, period: Period, count: number): number {
  const pensionCat = data.revenueCategories.find((c) => c.name === "Pension")?.id;
  const total = data.revenues
    .filter((r) => dateInPeriod(r.date, period) && (!pensionCat || r.categoryId === pensionCat))
    .reduce((s, r) => s + r.amount, 0);
  return count ? Math.round(total / count) : 0;
}

/**
 * A local, data-grounded advisor. Deterministic but genuinely tied to the
 * user's numbers and to the commercially-realistic logic. The free-text
 * understanding (a real LLM) plugs in behind matchIntent() once a backend is
 * available — this is the offline brain in the meantime.
 */
export function advisorAnswer(
  key: string,
  data: StableData,
  period: Period,
  capacity?: number,
): string {
  const s = stablePnl(data, period);
  const count = data.horses.filter((h) => !h.isArchived).length;
  const charges = s.directCosts + s.sharedCosts;
  const margin = s.revenue ? Math.round((s.netResult / s.revenue) * 100) : 0;

  switch (key) {
    case "profitability": {
      if (s.revenue === 0) return "Tu n'as encore rien encaissé sur ce mois. Saisis tes pensions et je te dirai où tu en es.";
      const verdict =
        s.netResult >= 0
          ? `tu gardes ${formatEur(s.netResult)}, soit ${margin} % de marge`
          : `tu perds ${formatEur(Math.abs(s.netResult))} ce mois`;
      return `Ce mois, tu encaisses ${formatEur(s.revenue)} et tu dépenses ${formatEur(charges)} : ${verdict}. La marge se joue surtout sur ton taux d'occupation et tes plus gros postes de coût.`;
    }
    case "improve_margin": {
      const recos = generateRecommendations(data, period, capacity).slice(0, 2);
      if (recos.length === 0) return "Rien d'évident à bouger : continue à saisir, je te signalerai le moindre levier.";
      const lines = recos.map((r) => `• ${r.title}${r.expectedImpact > 0 ? ` (≈ ${formatEur(r.expectedImpact)}/mois)` : ""}`);
      return `Tes deux meilleurs leviers, dans l'ordre :\n${lines.join("\n")}\n\nOuvre « Ton plan de la semaine » pour t'engager dessus.`;
    }
    case "new_horse_price": {
      const floor = capacity ? Math.round(charges / capacity) : count ? Math.round(charges / count) : 0;
      const avg = avgPension(data, period, count);
      return `Ton coût de revient par place est d'environ ${formatEur(floor)}/mois (tes charges ÷ tes places). C'est ton prix plancher : en dessous, le cheval te coûte. Ton tarif moyen actuel tourne autour de ${formatEur(avg)}. Selon ta région et tes prestations, tu peux te placer au-dessus — et surtout, n'ajuste pas un client existant : c'est le tarif du prochain entrant que tu fixes.`;
    }
    case "biggest_costs": {
      const top = expenseBreakdown(data, [period]).slice(0, 3);
      if (top.length === 0) return "Aucune charge enregistrée ce mois.";
      const lines = top.map((b) => `• ${b.label} : ${formatEur(b.amount)} (${Math.round(b.share * 100)} %)`);
      return `Tes plus gros postes ce mois :\n${lines.join("\n")}\n\nLes négociables (foin, granulés, énergie, assurance) sont des leviers. Les salaires et le loyer, eux, s'allègent en remplissant l'écurie, pas en les coupant.`;
    }
    case "fill_potential": {
      if (!capacity || count >= capacity) {
        return `Ton écurie est pleine (${count} chevaux). Le levier n'est plus le volume mais le tarif et les prestations (cours, transport, demi-pension).`;
      }
      const empty = capacity - count;
      const avg = avgPension(data, period, count);
      const potential = empty * avg;
      return `Tu as ${empty} place${empty > 1 ? "s" : ""} libre${empty > 1 ? "s" : ""}. Les remplir, c'est ~${formatEur(potential)}/mois de pensions en plus — et comme tes charges fixes sont déjà payées, chaque cheval ajouté améliore ta marge plus que proportionnellement. C'est ton premier levier.`;
    }
    case "recurring": {
      const recs = recurringList(data);
      if (recs.length === 0) return "Aucune charge récurrente enregistrée. Tu peux en ajouter une (crédit, abonnement, assurance) avec une date de début et de fin.";
      const lines = recs.map(
        (r) => `• ${r.label} : ${formatEur(r.amount)} (${r.frequency === "monthly" ? "par mois" : r.frequency === "quarterly" ? "par trimestre" : "par an"})${r.endDate ? `, jusqu'au ${r.endDate}` : ""}`,
      );
      return `Tes charges récurrentes :\n${lines.join("\n")}`;
    }
    default:
      return "Je m'appuie sur tes chiffres. Pose-moi une question sur ta rentabilité, tes coûts, ton tarif ou tes places.";
  }
}

/** Map free text to the closest topic (the offline stand-in for the LLM). */
export function matchIntent(text: string): string {
  const t = text.toLowerCase();
  if (/(rempl|place|occup|capacit|vide)/.test(t)) return "fill_potential";
  if (/(tarif|prix|pension|nouveau|entrant|combien.*facturer)/.test(t)) return "new_horse_price";
  if (/(co[uû]t|cher|d[ée]pense|poste|charge)/.test(t)) return "biggest_costs";
  if (/(cr[ée]dit|r[ée]current|abonnement|assurance|mensualit)/.test(t)) return "recurring";
  if (/(marge|am[ée]liorer|gagner|optimi|rentab)/.test(t)) return "improve_margin";
  return "profitability";
}
