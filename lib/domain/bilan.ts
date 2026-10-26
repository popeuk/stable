import { seuilEtPlaces, type MonthBreakdown } from "./ticket";

/**
 * La lecture du bilan : ce que disent les chiffres et que le gérant ne voit
 * pas seul, puis les pistes avec ce qu'elles coûtent. Jamais de conseil
 * évident (« remplis tes places ») ni de gain promis sans son coût : une
 * place remplie mange, une hausse peut faire partir un client.
 */
export interface LectureBilan {
  /** Ce que coûte un cheval chez toi : frais de l'écurie et soins, partagés entre tous les chevaux, les tiens compris. */
  coutCheval: number | null;
  /** Le prix de la pension (le tarif, sinon la moyenne des pensions du mois). */
  pension: number | null;
  /** Ce qu'il manque à une pension pour payer sa part (positif) ou ce qu'elle laisse en plus (négatif). */
  ecart: number | null;
  /** Ce qui rentre en dehors des pensions : cours, prestations. */
  cours: number;
  /** Même avec toutes les places en pension, ce qui manque encore par mois. */
  memePlein: { places: number; manque: number } | null;
  /** Les chevaux du gérant et ce qu'ils coûtent à l'écurie, environ. */
  miens: number;
  coutMiens: number;
  /** Les places libres (null sans nombre de places). */
  libres: number | null;
  /** Une hausse posée à côté de ce qu'efface un seul départ. */
  hausse: { pas: number; gain: number; depart: number } | null;
  /** Les frais donnés en un seul total : on ne sait pas ce que coûte un cheval de plus. */
  fraisEnUnTotal: boolean;
}

const r0 = (n: number) => Math.round(n);

export function lireBilan(
  m: Pick<MonthBreakdown, "sharedTotal" | "direct" | "horseCount" | "pensions" | "miens" | "seuil" | "aCouvrir" | "contribution" | "shared">,
  o: { pension?: number; pensionsDuMois: number; cours: number; capacity: number },
): LectureBilan {
  const coutCheval = m.horseCount > 0 ? r0((m.sharedTotal + m.direct) / m.horseCount) : null;
  const pension = o.pension && o.pension > 0 ? o.pension : m.pensions > 0 && o.pensionsDuMois > 0 ? r0(o.pensionsDuMois / m.pensions) : null;
  const ecart = coutCheval !== null && pension !== null ? r0(coutCheval - pension) : null;
  const p = seuilEtPlaces(m, o.capacity);
  const memePlein = p.places > 0 && isFinite(m.seuil) && !p.atteignable && p.placesPensions !== null ? { places: p.placesPensions, manque: p.manque } : null;
  const libres = o.capacity > 0 ? Math.max(0, p.places - m.pensions - m.miens) : null;
  const pas = 20;
  const hausse = pension !== null && m.pensions >= 2 ? { pas, gain: pas * m.pensions, depart: pension } : null;
  return {
    coutCheval,
    pension,
    ecart,
    cours: Math.max(0, r0(o.cours)),
    memePlein,
    miens: m.miens,
    coutMiens: coutCheval !== null ? coutCheval * m.miens : 0,
    libres,
    hausse,
    fraisEnUnTotal: m.shared.length <= 1,
  };
}
