import type { ISODate, Period, StableData } from "@/lib/domain/types";
import { addDays } from "@/lib/domain/care";
import { clientDues, type ClientDue } from "@/lib/domain/clients-dus";
import { careToValidate, dayItems, seanceToValidate, type DayItem } from "@/lib/domain/seances";
import { addMonths, daysInMonth } from "@/lib/utils/period";
import { r2 } from "@/lib/utils/arrondi";

/**
 * Tout compte, tu retires. Ce qui est au planning et dont l'heure est passée
 * compte tout seul : une séance prévue devient faite (tous les inscrits
 * présents), un soin prévu passe au carnet à sa date. Le gérant retire
 * seulement ce qui n'a pas eu lieu. Les tâches ne sont pas concernées, une
 * séance sans inscrit ni cheval ne crée rien. Domaine pur, zéro framework.
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
  seances: string[];
  soins: SoinACompter[];
}

/** Ce qui doit compter maintenant : séances finies, soins passés, encore « prévus ». */
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
