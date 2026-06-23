import type { Period, StableData } from "@/lib/domain/types";
import { horsePnl, stablePnl, expenseBreakdown } from "@/lib/domain/calculations";
import { dateInPeriod, periodKey } from "@/lib/utils/period";
import { formatEur } from "@/lib/utils/format-currency";

export type RecoType =
  | "fill_capacity"
  | "negotiate_cost"
  | "index_pensions"
  | "upsell_services"
  | "reprice_underpriced"
  | "reorganize_staff";

export interface Recommendation {
  id: string;
  type: RecoType;
  title: string;
  why: string;
  /** Expected gain in € per month (0 when not directly quantifiable). */
  expectedImpact: number;
  /** "/mois" gain, or "potentiel" for growth levers. */
  impactKind?: "gain" | "potentiel";
  relatedHorseId?: string;
  costPost?: string;
  lessonKey?: string;
  scenarioHref?: string;
}

/** Cost posts that are genuinely negotiable (vs fixed contracts). */
const NEGOTIABLE = new Set([
  "Foin",
  "Granulés",
  "Litière",
  "Eau",
  "Électricité",
  "Assurance",
  "Entretien",
  "Fournitures",
]);
const FIXED_CONTRACT = new Set(["Personnel", "Loyer / foncier"]);

function round(n: number) {
  return Math.round(n);
}

/**
 * Commercially-realistic advice. Profitability in a boarding stable is driven
 * by occupancy and pricing discipline — not by abruptly hiking one client's
 * pension or cutting a contracted salary. Levers, in order of business sense:
 *   1. Fill empty stalls (growth + fixed-cost dilution).
 *   2. Renegotiate genuinely negotiable supply costs.
 *   3. Gentle, across-the-board annual indexation at renewal.
 *   4. Sell add-on services rather than raise base pensions.
 *   5. Flag under-priced places to realign at the next renewal (never abruptly).
 */
export function generateRecommendations(
  data: StableData,
  period: Period,
  capacity?: number,
): Recommendation[] {
  const pk = periodKey(period);
  const recos: Recommendation[] = [];
  const active = data.horses.filter((h) => !h.isArchived);
  const count = active.length;
  const s = stablePnl(data, period);

  // Average pension actually charged (the "Pension" category), per horse.
  const pensionCatId = data.revenueCategories.find((c) => c.name === "Pension")?.id;
  const pensionTotal = data.revenues
    .filter((r) => dateInPeriod(r.date, period) && (!pensionCatId || r.categoryId === pensionCatId))
    .reduce((sum, r) => sum + r.amount, 0);
  const avgPension = count ? round(pensionTotal / count) : 0;

  // 1) Fill empty stalls — the real growth lever.
  if (capacity && count < capacity) {
    const empty = capacity - count;
    const potential = round(empty * (avgPension || s.revenue / Math.max(1, count)));
    recos.push({
      id: `fill_capacity-${pk}`,
      type: "fill_capacity",
      title: `Remplis tes ${empty} place${empty > 1 ? "s" : ""} libre${empty > 1 ? "s" : ""}`,
      why: `Tu accueilles ${count} chevaux sur ${capacity} places. Chaque place vide, c'est ~${formatEur(avgPension)}/mois de pension en moins — et comme ton foin, ton personnel et ton loyer sont déjà payés, un nouveau cheval les dilue : ta marge grimpe vite. Potentiel : ${formatEur(potential)}/mois.`,
      expectedImpact: potential,
      impactKind: "potentiel",
      lessonKey: "taux_occupation",
      scenarioHref: "/scenarios/nouveau",
    });
  }

  // 2) Renegotiate the heaviest *negotiable* supply cost (never salaries/rent).
  const breakdown = expenseBreakdown(data, [period]);
  const biggestNeg = breakdown.find((b) => NEGOTIABLE.has(b.label));
  if (biggestNeg && biggestNeg.amount > 0) {
    const impact = round(biggestNeg.amount * 0.08);
    recos.push({
      id: `negotiate_cost-${biggestNeg.label}-${pk}`,
      type: "negotiate_cost",
      title: `Renégocie « ${biggestNeg.label} »`,
      why: `« ${biggestNeg.label} » te coûte ${formatEur(biggestNeg.amount)}/mois. C'est un poste qui se négocie (fournisseur, volume, contrat) : ~8 % de moins, c'est ${formatEur(impact)}/mois récupérés. À l'inverse des salaires, ces charges-là sont des leviers.`,
      expectedImpact: impact,
      impactKind: "gain",
      costPost: biggestNeg.label,
      lessonKey: "negocier_charges",
    });
  }

  // 3) Gentle annual indexation — general and at renewal, not abrupt.
  if (s.revenue > 0) {
    const impact = round(s.revenue * 0.03);
    recos.push({
      id: `index_pensions-${pk}`,
      type: "index_pensions",
      title: "Indexe tes pensions de 3 % à l'échéance",
      why: `Une revalorisation annuelle douce de 3 %, appliquée à tout le monde au renouvellement, c'est ~${formatEur(impact)}/mois. Acceptée commercialement car progressive et générale — contrairement à une hausse brutale sur un seul cheval, qui ferait fuir le client.`,
      expectedImpact: impact,
      impactKind: "gain",
      lessonKey: "pension_indexee",
      scenarioHref: "/scenarios/nouveau",
    });
  }

  // 4) Sell add-on services instead of raising the base pension.
  if (count > 0) {
    const impact = round(count * 0.3 * 50); // ~30% of horses take a ~50€ service
    recos.push({
      id: `upsell_services-${pk}`,
      type: "upsell_services",
      title: "Vends des prestations en plus",
      why: `Plutôt que de toucher aux pensions, propose des services à valeur ajoutée : cours, transport, travail du cheval, demi-pension. Si un cheval sur trois prend une prestation à ~50 €, c'est ${formatEur(impact)}/mois — sans changer un seul tarif de base.`,
      expectedImpact: impact,
      impactKind: "potentiel",
      lessonKey: "roi_cheval",
    });
  }

  // 5) Flag an under-priced place — to realign at renewal, softly.
  const underPriced = active
    .map((h) => ({ horse: h, p: horsePnl(data, h.id, period) }))
    .filter((x) => x.p.revenue > 0 && x.p.netResult < 0)
    .sort((a, b) => a.p.netResult - b.p.netResult)[0];
  if (underPriced) {
    const { horse, p } = underPriced;
    recos.push({
      id: `reprice_underpriced-${horse.id}-${pk}`,
      type: "reprice_underpriced",
      title: `${horse.name} est sous son coût`,
      why: `${horse.name} te rapporte ${formatEur(p.revenue)} pour ${formatEur(p.threshold)} de coût. Pas de hausse brutale : réaligne au prochain renouvellement, compense par une prestation, ou applique ce tarif au prochain cheval qui prend la place.`,
      expectedImpact: Math.abs(p.netResult),
      impactKind: "potentiel",
      relatedHorseId: horse.id,
      lessonKey: "justifier_hausse",
    });
  }

  // 6) Staff weighs heavily AND stalls are empty → fill, don't cut.
  const staff = breakdown.find((b) => FIXED_CONTRACT.has(b.label));
  if (staff && capacity && count < capacity && staff.share > 0.3) {
    recos.push({
      id: `reorganize_staff-${pk}`,
      type: "reorganize_staff",
      title: "Ton personnel pèse car des places sont vides",
      why: `« ${staff.label} » représente ${Math.round(staff.share * 100)} % de tes charges. On ne baisse pas un salaire sous contrat : le bon levier, c'est de remplir l'écurie pour répartir ce coût sur plus de chevaux. À défaut, réorganise les horaires plutôt que de couper.`,
      expectedImpact: 0,
      lessonKey: "negocier_charges",
    });
  }

  return recos.sort((a, b) => b.expectedImpact - a.expectedImpact);
}
