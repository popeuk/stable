import type { Period, StableData } from "@/lib/domain/types";
import { billsFor, monthKey } from "@/lib/domain/billing";

/**
 * Le chiffre du mois est-il une estimation ? Oui tant que tout ce qui rentre
 * vient de chevaux sans propriétaire (personne à qui le demander : la pension
 * vient des tarifs, pas d'un client) et qu'aucun paiement n'est arrivé ce
 * mois. C'est le cas d'une écurie neuve qui sort du parcours. Une
 * estimation se dit comme telle, à l'encre : « Si tout est payé : … ».
 */
export function estEstimation(data: StableData, period: Period): boolean {
  const bills = billsFor(data, period);
  const orphan = bills.filter((b) => b.orphan).reduce((t, b) => t + b.total, 0);
  const reel = bills.filter((b) => !b.orphan).reduce((t, b) => t + b.total, 0);
  const mk = monthKey(period);
  const paye = (data.payments ?? []).some((p) => p.month === mk);
  return Math.round(orphan) > 0 && Math.round(reel) === 0 && !paye;
}

/**
 * « Tu gagnes ta vie » : seulement sur de l'argent réel, et au-delà d'un
 * seuil sensé, un smic net à peu près (1 400 € par mois). En dessous,
 * l'écurie gagne de l'argent, sans plus.
 */
export const GAGNER_SA_VIE = 1400;
