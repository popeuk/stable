import type { Horse, ISODate, Period, SharedExpense, SharedExpenseAllocation, StableData } from "@/lib/domain/types";
import { distribute } from "@/lib/domain/distribution";
import { dateInPeriod, periodEnd, periodStart } from "@/lib/utils/period";
import { compteEntre, debutCompte, donnerSejours, finCompte, revenirLe, sejourDuMois, sejours } from "@/lib/domain/sejours";
import { r2 } from "@/lib/utils/arrondi";

/**
 * Qui était là, et quand. Un cheval vit à l'écurie par séjours
 * (lib/domain/sejours) : il compte dans les mois où il était là, plus
 * entre deux séjours ni après son départ. Son argent des mois passés ne
 * bouge pas ; sa pension n'est plus postée ; il ne prend plus de part des
 * frais communs. Il reste retrouvable (les chevaux partis) et peut revenir :
 * un retour ajoute un séjour sans toucher aux précédents.
 *
 * Un cheval archivé avant la règle des dates n'a pas de date de départ. La
 * migration douce (`dateDepartPresumee`) lui en donne une : le jour de sa
 * dernière ligne d'argent, sinon son jour d'arrivée. En attendant (données
 * reçues d'ailleurs), un cheval archivé sans date ne partage plus rien,
 * mais son argent déjà noté compte toujours dans les mois où il est noté :
 * rien ne disparaît. Domaine pur.
 */

type HorseLike = Parameters<typeof sejours>[0];

/** Le cheval est-il parti avant ce jour, sans revenir depuis ? (un cheval parti le 10 est encore là le 10) */
export function partiAvant(h: HorseLike, date: ISODate): boolean {
  const s = sejours(h).filter((x) => debutCompte(x) <= date).at(-1);
  if (!s) return false;
  const f = finCompte(s);
  return f !== null && f < date;
}

/** Comptait-il dans l'argent de ce mois, ne serait-ce qu'un jour ? */
export function presentDans(h: HorseLike, p: Period): boolean {
  return compteEntre(h, periodStart(p), periodEnd(p));
}

/**
 * Une récurrente propre à un cheval (pension, charge à lui) compte-t-elle ce
 * mois ? Oui s'il y était, même revenu en cours de mois ; non s'il était
 * parti (ou entre deux séjours). Le même test pour les chiffres et le CSV.
 */
export function recurrenteDuCheval(h: HorseLike, p: Period): boolean {
  return presentDans(h, p) || !partiAvant(h, periodStart(p));
}

/** Le jour où une récurrente d'un cheval tombe ce mois : son jour habituel, ou son arrivée s'il est arrivé (ou revenu) après. */
export function jourDuCheval(h: HorseLike, p: Period, jour: ISODate): ISODate {
  const s = sejourDuMois(h, p);
  const d = s ? debutCompte(s) : "";
  return d > jour && d <= periodEnd(p) ? d : jour;
}

/** Les chevaux qui partagent les frais communs d'un mois : ceux qui étaient là. */
export function chevauxPresents(data: Pick<StableData, "horses">, p: Period): Horse[] {
  return data.horses.filter((h) => presentDans(h, p));
}

/** Les chevaux qui ont une ligne d'argent dans le mois (recette, dépense, part figée). */
function chevauxAvecArgent(data: StableData, p: Period): Set<string> {
  const ids = new Set<string>();
  for (const r of data.revenues) if (r.horseId && dateInPeriod(r.date, p)) ids.add(r.horseId);
  for (const e of data.directExpenses) if (e.horseId && dateInPeriod(e.date, p)) ids.add(e.horseId);
  for (const se of data.sharedExpenses) {
    if (se.periodYear !== p.year || se.periodMonth !== p.month) continue;
    for (const a of se.allocations) ids.add(a.horseId);
  }
  return ids;
}

/**
 * Les chevaux qui comptent dans le bilan d'un mois : ceux qui étaient là,
 * plus ceux qui y ont de l'argent noté (un cheval parti garde son passé).
 */
export function chevauxDuMois(data: StableData, p: Period): Horse[] {
  const argent = chevauxAvecArgent(data, p);
  return data.horses.filter((h) => presentDans(h, p) || argent.has(h.id));
}

/**
 * La répartition d'une facture commune. Notée avec une répartition (le
 * détail choisi à la saisie), elle reste telle quelle. Notée sans (le « + »,
 * une tâche faite, ou sans aucun cheval), elle se partage entre les chevaux
 * présents ce mois-là : un cheval arrivé ce mois paie sa part, un cheval
 * arrivé après n'en paie rien. Sans aucun cheval présent, la liste est vide
 * et la facture reste dans le mois de l'écurie (voir `facturesSansCheval`).
 */
/**
 * Le jour d'une dépense de l'écurie : celui où elle a été notée (ou choisi),
 * pour l'historique et le fichier du comptable. Une dépense d'avant, sans
 * jour noté, reste au 1er de son mois.
 */
export function jourDepense(se: Pick<SharedExpense, "date" | "periodYear" | "periodMonth">): ISODate {
  const mois = `${se.periodYear}-${String(se.periodMonth).padStart(2, "0")}`;
  return se.date && se.date.slice(0, 7) === mois ? se.date : `${mois}-01`;
}

export function repartition(data: StableData, se: SharedExpense): SharedExpenseAllocation[] {
  if (se.allocations.length) return se.allocations;
  const p = { year: se.periodYear, month: se.periodMonth };
  return distribute(se.totalAmount, chevauxPresents(data, p), se.distributionMode ?? "equal", p);
}

/**
 * Les frais communs d'un mois qu'aucun cheval ne porte, parce qu'il n'y
 * avait aucun cheval : ils comptent quand même dans le mois (les frais communs
 * de l'écurie), ils ne disparaissent pas.
 */
export function facturesSansCheval(data: StableData, p: Period, recurringShared: number): number {
  if (chevauxPresents(data, p).length) return 0;
  const notees = data.sharedExpenses
    .filter((se) => se.periodYear === p.year && se.periodMonth === p.month && se.allocations.length === 0)
    .reduce((t, se) => t + se.totalAmount, 0);
  return r2((notees + recurringShared));
}

/**
 * La date de départ à donner à un cheval archivé avant la règle des dates :
 * sa dernière ligne d'argent (le passé reste entier), sinon son arrivée.
 */
export function dateDepartPresumee(data: StableData, horseId: string): ISODate {
  const h = data.horses.find((x) => x.id === horseId);
  const dates: ISODate[] = [
    ...data.revenues.filter((r) => r.horseId === horseId).map((r) => r.date),
    ...data.directExpenses.filter((e) => e.horseId === horseId).map((e) => e.date),
    ...data.sharedExpenses
      .filter((se) => se.allocations.some((a) => a.horseId === horseId))
      .map((se) => periodEnd({ year: se.periodYear, month: se.periodMonth })),
  ];
  const last = dates.sort().at(-1);
  return last ?? h?.entryDate ?? "1970-01-01";
}

/** La migration douce : chaque cheval archivé sans date de départ en reçoit une. */
export function daterLesDeparts<T extends StableData>(data: T): T {
  if (!data.horses?.some((h) => h.isArchived && !h.exitDate && !h.stays?.length)) return data;
  return { ...data, horses: data.horses.map((h) => (h.isArchived && !h.exitDate && !h.stays?.length ? { ...h, exitDate: dateDepartPresumee(data, h.id) } : h)) };
}

/**
 * La migration des séjours (version 5) : chaque cheval reçoit ses séjours,
 * faits de ses dates d'arrivée et de départ et de son identité (provenance,
 * destination, motifs) des versions d'avant. Rien d'autre ne change.
 */
export function migrerSejours<T extends StableData>(data: T): T {
  const d = daterLesDeparts(data);
  if (!d.horses?.some((h) => !h.stays?.length)) return d;
  return { ...d, horses: d.horses.map((h) => donnerSejours(h)) };
}

/**
 * Un cheval parti revient aujourd'hui (voir `revenirLe` pour une autre date) :
 * un nouveau séjour commence, les précédents ne bougent pas. Revenu le jour
 * même ou le lendemain d'un départ de ce mois-ci : le départ était une
 * erreur, le séjour reprend comme avant.
 */
export function revenirALEcurie(h: Horse, today: ISODate, date: ISODate = today): Horse {
  return revenirLe(h, date, today);
}

/**
 * Arrêter une récurrente : elle compte encore les mois où elle a déjà compté,
 * plus après. Une récurrente qui n'a jamais compté (commencée après ce
 * jour) s'arrête la veille de son début : elle ne compte nulle part.
 */
export function arreterRecurrentes<T extends { id: string; startDate: ISODate; endDate?: ISODate | null }>(list: T[], id: string, today: ISODate): T[] {
  return list.map((r) => {
    if (r.id !== id) return r;
    // Dans le mois en cours, elle a déjà compté (une échéance par mois) : on ne la retire pas du mois.
    const endDate = r.startDate > today ? veille(r.startDate) : today;
    return { ...r, endDate: r.endDate && r.endDate < endDate ? r.endDate : endDate };
  });
}

function veille(d: ISODate): ISODate {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

/** « frais communs · entre 3 chevaux », ou sans cheval pour l'instant. */
export function partageLabel(n: number): string {
  if (n === 0) return "frais de l’écurie · aucun cheval ce mois-ci, comptés quand même";
  return `frais de l’écurie · entre ${n} cheva${n > 1 ? "ux" : "l"}`;
}
