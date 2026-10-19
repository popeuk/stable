import type { ISODate, StableData } from "@/lib/domain/types";
import { recettesFacturees } from "@/lib/domain/factures-base";
import { jourDepense } from "@/lib/domain/presence";

/**
 * Corriger une ligne d'argent : une recette, une dépense d'un cheval ou hors
 * chevaux, une dépense de l'écurie, ou ce qui revient chaque mois (une
 * rentrée, un frais). La ligne se rouvre dans la même feuille que le +,
 * remplie, et s'enregistre à sa place. Domaine pur.
 */
export type LigneArgent =
  | { t: "rev"; id: string }
  | { t: "dir"; id: string }
  | { t: "sh"; id: string }
  | { t: "recrev"; id: string }
  | { t: "recexp"; id: string };

/**
 * La facture où se trouve déjà la ligne, ou rien. Une recette facturée ne
 * se corrige pas (ni ne se retire) ici : la facture est figée, on fait un
 * avoir. Une dépense refacturée suit sa recette.
 */
export function factureDeLigne(data: Pick<StableData, "invoices" | "directExpenses">, l: LigneArgent): string | undefined {
  const f = recettesFacturees(data.invoices);
  if (l.t === "rev") return f.get(l.id);
  if (l.t === "dir") {
    const e = data.directExpenses.find((x) => x.id === l.id);
    return e?.rebillRevenueId ? f.get(e.rebillRevenueId) : undefined;
  }
  return undefined;
}

/** « Cette ligne est sur la facture n° 2026-0001 : pour la changer, fais un avoir depuis la facture. » */
export const messageFacturee = (numero: string) => `Cette ligne est sur la facture n° ${numero} : pour la changer, fais un avoir depuis la facture.`;

/** Ce que la feuille remplit pour une ligne : le sens, le montant, pour qui, ce que c'est, le jour. */
export interface LigneRemplie {
  sens: "in" | "out";
  amount: number;
  pour: "cheval" | "ecurie" | "hors";
  horseIds: string[];
  label: string;
  date: ISODate;
  /** Une ligne qui revient chaque mois (rentrée ou frais). */
  revient: boolean;
  /** Une dépense de l'écurie qui fait partie de l'estimation : sur combien de mois elle se décompte. */
  dansMois?: number;
}

/** La ligne telle que la feuille la remplit, ou null si elle n'existe plus. */
export function ligneRemplie(data: StableData, l: LigneArgent): LigneRemplie | null {
  const cat = (id?: string) => [...data.revenueCategories, ...data.expenseCategories].find((c) => c.id === id)?.name ?? "";
  if (l.t === "rev") {
    const r = data.revenues.find((x) => x.id === l.id);
    if (!r) return null;
    return { sens: "in", amount: r.amount, pour: r.horseId ? "cheval" : "hors", horseIds: r.horseId ? [r.horseId] : [], label: r.note || cat(r.categoryId), date: r.date, revient: false };
  }
  if (l.t === "dir") {
    const e = data.directExpenses.find((x) => x.id === l.id);
    if (!e) return null;
    return { sens: "out", amount: e.amount, pour: e.horseId ? "cheval" : "hors", horseIds: e.horseId ? [e.horseId] : [], label: e.label || cat(e.categoryId), date: e.date, revient: false };
  }
  if (l.t === "sh") {
    const s = data.sharedExpenses.find((x) => x.id === l.id);
    if (!s) return null;
    return { sens: "out", amount: s.totalAmount, pour: "ecurie", horseIds: [], label: s.label || cat(s.categoryId), date: jourDepense(s), revient: false, ...(s.dansEstimation ? { dansMois: s.dansMois ?? 1 } : {}) };
  }
  if (l.t === "recrev") {
    const r = (data.recurringRevenues ?? []).find((x) => x.id === l.id);
    if (!r) return null;
    return { sens: "in", amount: r.amount, pour: "cheval", horseIds: [r.horseId], label: r.label || cat(r.categoryId), date: r.startDate, revient: true };
  }
  const r = (data.recurringExpenses ?? []).find((x) => x.id === l.id);
  if (!r) return null;
  return { sens: "out", amount: r.amount, pour: r.isShared ? "ecurie" : "cheval", horseIds: r.horseId ? [r.horseId] : [], label: r.label || cat(r.categoryId), date: r.startDate, revient: true };
}

/** Le dernier jour du mois qui précède `today` (AAAA-MM-JJ). */
function finDuMoisDAvant(today: ISODate): ISODate {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  return new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
}

/**
 * Corrige une ligne qui revient chaque mois. Le passé ne bouge pas : si elle
 * a déjà compté avant ce mois-ci et que son montant change, l'ancienne
 * s'arrête à la fin du mois dernier et la corrigée reprend au 1er du mois
 * (`nouvelId`). Sinon (nom seulement, ou commencée ce mois-ci), elle est
 * corrigée à sa place. Une ligne tous les trois mois ou chaque année garde
 * son calendrier et se corrige à sa place.
 */
export function corrigerRecurrente<T extends { id: string; amount: number; startDate: ISODate; endDate?: ISODate | null; frequency: string }>(
  list: T[],
  id: string,
  patch: Partial<Omit<T, "id">>,
  today: ISODate,
  nouvelId: string,
): T[] {
  const r = list.find((x) => x.id === id);
  if (!r) return list;
  const debut = `${today.slice(0, 7)}-01`;
  const montantChange = patch.amount !== undefined && patch.amount !== r.amount;
  const finie = !!r.endDate && r.endDate < debut;
  if (!montantChange || r.frequency !== "monthly" || r.startDate >= debut || finie) return list.map((x) => (x.id === id ? { ...x, ...patch } : x));
  const fin = finDuMoisDAvant(today);
  const suite = { ...r, ...patch, id: nouvelId, startDate: debut, endDate: r.endDate ?? null } as T;
  return [...list.map((x) => (x.id === id ? { ...x, endDate: fin } : x)), suite];
}
