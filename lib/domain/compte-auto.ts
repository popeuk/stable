import type { ISODate, Period, Seance, StableData } from "@/lib/domain/types";
import { addDays } from "@/lib/domain/care";
import { clientDues, type ClientDue } from "@/lib/domain/clients-dus";
import { careToValidate, dayItems, seanceAmount, seanceToValidate, type DayItem } from "@/lib/domain/seances";
import { addMonths, daysInMonth } from "@/lib/utils/period";
import { r2 } from "@/lib/utils/arrondi";

/**
 * Ce qui compte, et quand. Depuis le 27 novembre 2026 (décision de Samuel,
 * validation reprise de l'app du Clos) : **une séance ne compte que validée**.
 * Passée, elle attend dans « À valider » ; le gérant la valide (d'un geste,
 * ou tout un jour d'un coup) ou dit qu'elle n'a pas eu lieu. Les soins
 * passés, eux, comptent toujours tout seuls (passent au carnet à leur date).
 * Les tâches ne sont pas concernées, une séance sans inscrit ni cheval ne
 * crée rien. Domaine pur, zéro framework.
 */

export interface SoinACompter {
  /** Les actes d'un même groupe (une ferrure de trois chevaux…). */
  ids: string[];
  /** Les chevaux présents : tous. */
  horseIds: string[];
  /** La date réelle : la date prévue, déjà passée. */
  date: ISODate;
}

export interface ACompter {
  /** Les séances finies, encore prévues : à valider par le gérant, elles ne comptent pas seules. */
  seances: string[];
  /** Les soins passés : ils comptent tout seuls. */
  soins: SoinACompter[];
}

/** Ce qui est passé et encore « prévu » : les séances à valider, les soins à compter. */
export function aCompter(data: Pick<StableData, "seances" | "careEvents">, today: ISODate, nowHHMM: string): ACompter {
  const seances = (data.seances ?? []).filter((s) => seanceToValidate(s, today, nowHHMM)).map((s) => s.id);
  const groupes = new Map<string, SoinACompter>();
  for (const e of data.careEvents ?? []) {
    if (!careToValidate(e, today, nowHHMM)) continue;
    const k = e.groupId ?? e.id;
    const g = groupes.get(k) ?? { ids: [], horseIds: [], date: e.date };
    g.ids.push(e.id);
    g.horseIds.push(e.horseId);
    groupes.set(k, g);
  }
  return { seances, soins: [...groupes.values()] };
}

export const rienACompter = (p: ACompter) => p.seances.length === 0 && p.soins.length === 0;

export interface JourAValider {
  date: ISODate;
  seances: Seance[];
  /** Ce que la journée ajoutera au décompte une fois validée. */
  total: number;
}

/** Les séances à valider, jour par jour, du plus récent au plus ancien, chacune dans l'ordre des heures. */
export function aValider(data: Pick<StableData, "seances">, today: ISODate, nowHHMM: string): JourAValider[] {
  const parJour = new Map<string, Seance[]>();
  for (const s of data.seances ?? []) {
    if (!seanceToValidate(s, today, nowHHMM)) continue;
    parJour.set(s.date, [...(parJour.get(s.date) ?? []), s]);
  }
  return [...parJour.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, ss]) => {
      const seances = [...ss].sort((a, b) => a.start.localeCompare(b.start));
      return { date, seances, total: r2(seances.reduce((t, s) => t + seanceAmount({ ...s, status: "done" }), 0)) };
    });
}

/** Combien de séances attendent d'être validées. */
export const nbAValider = (data: Pick<StableData, "seances">, today: ISODate, nowHHMM: string) =>
  (data.seances ?? []).filter((s) => seanceToValidate(s, today, nowHHMM)).length;

/** Ce qui a compté un jour : les séances faites et les soins faits (pas les tâches). */
export function aCompteLe(data: StableData, date: ISODate, today: ISODate, nowHHMM: string): DayItem[] {
  return dayItems(data, date, today, nowHHMM).filter((i) => i.type !== "task" && i.done);
}

export interface JourCompte {
  date: ISODate;
  items: DayItem[];
  total: number;
}

/** Ce qui a compté ces derniers jours (aujourd'hui compris), du plus récent au plus ancien, jours vides omis. */
export function ceQuiACompte(data: StableData, today: ISODate, nowHHMM: string, jours = 7): JourCompte[] {
  const out: JourCompte[] = [];
  for (let i = 0; i < jours; i++) {
    const date = addDays(today, -i);
    const items = aCompteLe(data, date, today, nowHHMM);
    if (items.length) out.push({ date, items, total: r2(items.reduce((t, it) => t + (it.money ?? 0), 0)) });
  }
  return out;
}

/** Une séance à plusieurs : on y retire un absent, on ne la retire pas en bloc. */
export const estCollectif = (it: Pick<DayItem, "seance">) => (it.seance?.participants.length ?? 0) > 1;

/** « Qui était là ? » : une séance à plusieurs, ou une séance sans montant. */
export const demandePresence = (it: Pick<DayItem, "seance" | "money">) => !!it.seance && (estCollectif(it) || !it.money);

/**
 * La fin du mois : les 3 derniers jours du mois et les 5 premiers du mois
 * suivant. Renvoie le mois concerné (celui qui se termine, ou qui vient de
 * finir), sinon null.
 */
export function finDuMois(today: ISODate): Period | null {
  const [y, m, d] = today.split("-").map(Number);
  const p: Period = { year: y, month: m };
  if (d > daysInMonth(p) - 3) return p;
  if (d <= 5) return addMonths(p, -1);
  return null;
}

/**
 * Les clients qui te doivent encore, jusqu'au mois qui se termine, pendant la
 * fin du mois : le même « te doit » que la liste des clients (tous mois
 * confondus, au centime), et leur total.
 */
export function clientsAFairePayer(data: StableData, today: ISODate): { period: Period; clients: ClientDue[]; total: number } | null {
  const period = finDuMois(today);
  if (!period) return null;
  const clients = clientDues(data, period).filter((c) => c.due > 0);
  return { period, clients, total: r2(clients.reduce((t, c) => t + c.due, 0)) };
}
