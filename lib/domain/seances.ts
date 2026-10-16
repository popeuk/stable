import type { ISODate, Revenue, Seance, StableData, TeamTask } from "@/lib/domain/types";
import { CARE_META, addDays, type CareEvent } from "@/lib/domain/care";

/**
 * Les séances du planning (repris du planning des cours du Clos) et la
 * journée telle que l'app la montre : séances, soins, tâches d'équipe, à
 * leur heure, avec l'argent de chacune. Domaine pur, zéro framework.
 */

export const MAX_SEANCES = 60;
export const MAX_PLACES = 6;
export type Repeat = "once" | "weekly" | "biweekly" | "monthly";

/** Les dates d'une série : au plus 60 séances, au plus 12 mois. */
export function seriesDates(start: ISODate, repeat: Repeat, until?: ISODate): ISODate[] {
  if (repeat === "once" || !until || until < start) return [start];
  const limit = addDays(start, 366);
  const end = until < limit ? until : limit;
  const out: ISODate[] = [];
  if (repeat === "monthly") {
    const [y, m, d] = start.split("-").map(Number);
    for (let i = 0; out.length < MAX_SEANCES; i++) {
      const month = m - 1 + i;
      const yy = y + Math.floor(month / 12);
      const mm = ((month % 12) + 12) % 12;
      const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
      const iso = `${yy}-${String(mm + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
      if (iso > end) break;
      out.push(iso);
    }
    return out;
  }
  const step = repeat === "weekly" ? 7 : 14;
  for (let cur = start; cur <= end && out.length < MAX_SEANCES; cur = addDays(cur, step)) out.push(cur);
  return out;
}

/**
 * Une séance posée sans cavalier ni cheval : un créneau ouvert, personne
 * d'inscrit pour l'instant. Elle ne rapporte rien et n'attend aucune
 * validation tant que personne n'y est inscrit.
 */
export const isEmptySeance = (s: Pick<Seance, "participants" | "horseIds">) => s.participants.length === 0 && s.horseIds.length === 0;

/** Combien de personnes paient : présentes, plus les absents facturés. */
export function payingCount(s: Seance): number {
  if (s.participants.length === 0) return s.horseIds.length;
  if (s.status !== "done") return s.participants.length;
  return s.participants.filter((p) => p.present !== false || s.chargeAbsent).length;
}

/** Ce que la séance rapporte : prévu tant qu'elle n'est pas faite, réel ensuite. */
export function seanceAmount(s: Seance): number {
  if (s.status === "cancelled") return 0;
  return Math.round(s.unitPrice * payingCount(s) * 100) / 100;
}

/**
 * Les recettes à créer quand une séance est validée. Chaque cavalier qui
 * paie fait une recette au prix figé, rangée sur le cheval qu'il montait
 * (sinon répartie sur les chevaux de la séance), payée par lui.
 */
export function revenuesForSeance(
  s: Seance,
  data: Pick<StableData, "people" | "revenueCategories">,
  makeId: () => string,
  stableId: string,
): Revenue[] {
  if (s.status !== "done" || s.unitPrice <= 0) return [];
  const cat = data.revenueCategories.find((c) => c.name === "Cours")?.id;
  const out: Revenue[] = [];
  if (s.participants.length === 0) {
    for (const horseId of s.horseIds) {
      out.push({ id: makeId(), stableId, horseId, categoryId: cat, amount: s.unitPrice, date: s.date, note: s.title, source: "manual", seanceId: s.id });
    }
    return out;
  }
  const paying = s.participants.filter((p) => p.present !== false || s.chargeAbsent);
  paying.forEach((p, i) => {
    // Un cavalier sans cheval : la recette est à lui, hors des tickets des chevaux (horseId vide).
    const horseId = p.horseId ?? s.horseIds[i % Math.max(1, s.horseIds.length)] ?? "";
    const person = data.people?.find((x) => x.id === p.personId);
    out.push({
      id: makeId(),
      stableId,
      horseId,
      categoryId: cat,
      amount: s.unitPrice,
      date: s.date,
      note: p.present === false ? `${s.title} (absence facturée)` : s.title,
      source: "manual",
      payer: person?.name,
      seanceId: s.id,
    });
  });
  return out;
}

/** Une séance est à valider quand son heure de fin est passée. */
export function seanceToValidate(s: Seance, today: ISODate, nowHHMM: string): boolean {
  if (s.status !== "planned" || isEmptySeance(s)) return false;
  return s.date < today || (s.date === today && s.end <= nowHHMM);
}

/** Un soin prévu est à valider le lendemain de sa date (ou passée son heure). */
export function careToValidate(e: CareEvent, today: ISODate, nowHHMM: string): boolean {
  if (!e.pending) return false;
  return e.date < today || (e.date === today && !!e.start && e.start <= nowHHMM);
}

export type Tone = "g" | "r" | "o" | "n";

export interface DayItem {
  key: string;
  type: "seance" | "soin" | "task";
  start?: string;
  end?: string;
  title: string;
  sub: string;
  /** Positif = rapporte, négatif = coûte. */
  money?: number;
  tone: Tone;
  done: boolean;
  late: boolean;
  seance?: Seance;
  care?: CareEvent[];
  task?: TeamTask;
}

const hhmm = (s?: string) => s ?? "";

/** La journée : séances, soins, tâches d'équipe et rendez-vous, triés par heure. */
export function dayItems(data: StableData, date: ISODate, today: ISODate, nowHHMM: string): DayItem[] {
  const name = (id?: string) => data.horses.find((h) => h.id === id)?.name ?? "";
  const person = (id: string) => data.people?.find((p) => p.id === id)?.name ?? "";
  const items: DayItem[] = [];

  for (const s of data.seances ?? []) {
    if (s.date !== date || s.status === "cancelled") continue;
    const who = s.participants.length
      ? s.participants.map((p) => person(p.personId)).filter(Boolean)
      : s.horseIds.map(name);
    const places = s.places ?? MAX_PLACES;
    const sub = [
      isEmptySeance(s)
        ? s.format === "collectif"
          ? `personne d’inscrit pour l’instant · ${places} place${places > 1 ? "s" : ""} libre${places > 1 ? "s" : ""}`
          : "personne d’inscrit pour l’instant"
        : s.format === "collectif"
          ? `${s.participants.length} sur ${places}`
          : who.slice(0, 2).join(", "),
      s.lieu,
    ].filter(Boolean).join(" · ");
    items.push({
      key: s.id,
      type: "seance",
      start: s.start,
      end: s.end,
      title: s.title,
      sub,
      money: seanceAmount(s) || undefined,
      tone: "g",
      done: s.status === "done",
      late: seanceToValidate(s, today, nowHHMM),
      seance: s,
    });
  }

  // Les soins : prévus (pending) ou faits ce jour-là, groupés comme une séance.
  const groups = new Map<string, CareEvent[]>();
  for (const e of data.careEvents ?? []) {
    if (e.date !== date) continue;
    const k = e.groupId ?? e.id;
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  for (const [k, evs] of groups) {
    const e0 = evs[0];
    const cost = evs.reduce((t, e) => t + (e.cost ?? 0), 0);
    const rev = evs.reduce((t, e) => t + (e.revenue ?? 0), 0);
    const isCours = e0.kind === "cours_collectif" || e0.kind === "cours_individuel";
    items.push({
      key: k,
      type: "soin",
      start: e0.start,
      title: `${CARE_META[e0.kind].label} · ${evs.map((e) => name(e.horseId)).slice(0, 2).join(", ")}${evs.length > 2 ? ` +${evs.length - 2}` : ""}`,
      sub: [e0.label, e0.provider].filter(Boolean).join(" · "),
      money: rev ? rev : cost ? -cost : undefined,
      tone: isCours ? "g" : "r",
      done: evs.every((e) => !e.pending),
      late: evs.some((e) => careToValidate(e, today, nowHHMM)),
      care: evs,
    });
  }

  for (const t of data.tasks ?? []) {
    if (!t.due || t.due.slice(0, 10) !== date) continue;
    const doneList = data.taskLists?.find((l) => l.isDone)?.id;
    const rdv = t.kind === "rdv";
    items.push({
      key: t.id,
      type: "task",
      start: t.due.length > 10 ? t.due.slice(11, 16) : undefined,
      end: rdv && t.end ? t.end : undefined,
      title: t.title,
      sub: [rdv ? "rendez-vous" : "", rdv ? t.lieu : "", t.forWho.join(", "), t.labels.join(" · ")].filter(Boolean).join(" · "),
      money: t.cost ? -t.cost : undefined,
      tone: t.cost ? "o" : "n",
      done: t.listId === doneList,
      late: false,
      task: t,
    });
  }

  return items.sort((a, b) => (hhmm(a.start) || "99").localeCompare(hhmm(b.start) || "99"));
}

/** Les couleurs d'un jour (points sous la date), au plus trois de chaque. */
export function dayTones(data: StableData, date: ISODate): Tone[] {
  const it = dayItems(data, date, "0000-00-00", "00:00");
  const g = it.filter((i) => i.tone === "g").length;
  const r = it.filter((i) => i.tone === "r").length;
  const o = it.filter((i) => i.tone === "o").length;
  return [...Array(Math.min(3, g)).fill("g"), ...Array(Math.min(3, r)).fill("r"), ...Array(Math.min(2, o)).fill("o")] as Tone[];
}

/** Les séances et soins passés qui attendent leur validation. */
export function toValidate(data: StableData, today: ISODate, nowHHMM: string): DayItem[] {
  const dates = new Set<string>();
  for (const s of data.seances ?? []) if (seanceToValidate(s, today, nowHHMM)) dates.add(s.date);
  for (const e of data.careEvents ?? []) if (careToValidate(e, today, nowHHMM)) dates.add(e.date);
  return [...dates]
    .sort()
    .flatMap((d) => dayItems(data, d, today, nowHHMM).filter((i) => i.late && i.type !== "task"));
}
