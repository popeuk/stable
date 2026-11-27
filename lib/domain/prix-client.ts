import type { Participant, PrixClient, StableData } from "@/lib/domain/types";

/**
 * Le prix propre à un client (27 novembre 2026, repris de l'app du Clos) :
 * un cavalier qui loue la carrière, ou prend un cheval du club, paie un autre
 * prix pour la même prestation. Le prix est figé sur sa place dans chaque
 * séance (Participant.unitPrice) quand il y est inscrit : changer un prix ne
 * réécrit pas le passé. Domaine pur, testé.
 */

/** Son prix propre pour cette prestation, ou undefined (il paie le prix de la prestation). */
export function prixPropre(data: Pick<StableData, "prixClients">, personId: string, prestationId: string): number | undefined {
  return (data.prixClients ?? []).find((x) => x.personId === personId && x.prestationId === prestationId)?.price;
}

/** Pose ou retire (prix nul ou vide) le prix propre d'un client. */
export function avecPrixClient(list: PrixClient[] | undefined, personId: string, prestationId: string, price: number | null): PrixClient[] {
  const autres = (list ?? []).filter((x) => !(x.personId === personId && x.prestationId === prestationId));
  return price != null && Number.isFinite(price) && price >= 0 ? [...autres, { id: `${personId}|${prestationId}`, personId, prestationId, price }] : autres;
}

/** Fige le prix propre des inscrits qui en ont un et qui n'en ont pas encore. Rend la même liste si rien ne change. */
export function figerPrixPropres(participants: Participant[], data: Pick<StableData, "prixClients">, prestationId: string): Participant[] {
  let change = false;
  const out = participants.map((p) => {
    if (p.unitPrice != null || !p.personId) return p;
    const prix = prixPropre(data, p.personId, prestationId);
    if (prix == null) return p;
    change = true;
    return { ...p, unitPrice: prix };
  });
  return change ? out : participants;
}

/** Ce que paie un inscrit : son prix figé, sinon le prix de la séance. */
export const prixDe = (p: Pick<Participant, "unitPrice">, unitPrice: number) => p.unitPrice ?? unitPrice;
