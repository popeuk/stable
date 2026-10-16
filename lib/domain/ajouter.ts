import type { ISODate, Prestation, Seance, SeanceFormat, StableData } from "@/lib/domain/types";
import { addDays, type CareKind } from "@/lib/domain/care";
import { norm } from "@/lib/domain/interpret";
import type { Compris, Pour } from "@/lib/domain/dire";

/**
 * Le + : ce que l'app propose d'avance. Les habitudes viennent des données
 * (les cours et leurs prix, l'heure habituelle déduite des séances passées,
 * le dernier prix et le dernier maréchal d'un soin), sinon une valeur sûre.
 * Le brouillon (Draft) est ce que la feuille montre et que « C’est bon »
 * enregistre. Domaine pur, testé.
 */
export type AjoutType = "seance" | "soin" | "rdv" | "argent";
export type Rep = "once" | "weekly" | "biweekly" | "monthly";
export type MoneyRep = "once" | "monthly" | "quarterly" | "yearly";
export type { Pour };

export interface CoursHabit {
  key: string;
  prestationId: string;
  format?: SeanceFormat;
  label: string;
  price: number;
  places: number;
  start: string;
  /** Durée habituelle, en minutes. */
  dur: number;
  lieu?: string;
  uses: number;
}

export interface SoinHabit {
  kind: CareKind;
  label: string;
  price?: number;
  start: string;
  provider?: string;
  uses: number;
}

export interface Habitudes {
  cours: CoursHabit[];
  soins: SoinHabit[];
  /** Les tâches et rendez-vous les plus récents, pour « C’est quoi ? ». */
  quoi: string[];
}

export interface Draft {
  type: AjoutType;
  date: ISODate;
  /** HH:MM. Pour un rendez-vous, null = sans heure, c'est une tâche. */
  start: string | null;
  dur: number;
  notes: string;
  qui: string[];
  horseIds: string[];
  // Séance
  coursKey: string | null;
  /** Le nom tapé ou dit d'un cours qui n'existe pas encore. */
  custom: string;
  places: number | null;
  /** Prix de la place (séance) ou coût (soin, tâche). null = sans prix. */
  price: number | null;
  lieu: string;
  rep: Rep;
  until: ISODate;
  cav: string[];
  // Soin
  care: CareKind | null;
  provider: string;
  refac: boolean;
  // Tâche ou rendez-vous
  quoi: string;
  listId?: string;
  labels: string[];
  end: string;
  rappel: string;
  // Argent
  sens: "in" | "out";
  amount: number;
  pour: Pour;
  label: string;
  catId?: string;
  comment: string;
  moneyRep: MoneyRep;
}

export const SOIN_LIST: [CareKind, string][] = [
  ["ferrure", "Maréchal"],
  ["vermifuge", "Vermifuge"],
  ["vaccin", "Vaccin"],
  ["veto", "Véto"],
  ["dentiste", "Dentiste"],
  ["osteo", "Ostéo"],
];
export const QUOI_SURS = ["Livraison du foin", "Visite du véto", "Réparer une clôture"];

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
export const fromMin = (n: number) => {
  const v = Math.max(0, Math.min(23 * 60 + 59, Math.round(n)));
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};
export const endOf = (start: string, dur: number) => fromMin(toMin(start) + dur);

/** La valeur la plus fréquente ; à égalité, la plus récente (la dernière vue). */
function mode<T>(xs: T[]): T | undefined {
  const n = new Map<T, number>();
  let best: T | undefined;
  let bc = 0;
  for (const x of xs) {
    const c = (n.get(x) ?? 0) + 1;
    n.set(x, c);
    if (c >= bc) {
      bc = c;
      best = x;
    }
  }
  return best;
}

export const coursKey = (prestationId: string, format?: SeanceFormat) => `${prestationId}:${format ?? ""}`;

function coursLabel(p: Prestation, format?: SeanceFormat): string {
  if (!format) return p.label;
  const isCours = /cours/.test(norm(p.label));
  if (format === "collectif") return isCours ? "Cours collectif" : `${p.label} en groupe`;
  return isCours ? "Cours particulier" : `${p.label} seul`;
}

export function habitudes(data: Pick<StableData, "prestations" | "seances" | "careEvents" | "tasks">, today: ISODate): Habitudes {
  const prestations = (data.prestations ?? []).filter((p) => p.active);
  const seances = (data.seances ?? []).filter((s) => s.status !== "cancelled").sort((a, b) => (a.date + a.start < b.date + b.start ? -1 : 1));
  const hasSolo = prestations.some((p) => !p.hasFormat && /particulier|individuel|prive/.test(norm(p.label)));
  const cours: CoursHabit[] = [];
  for (const p of prestations) {
    const formats: (SeanceFormat | undefined)[] = p.hasFormat ? (hasSolo ? ["collectif"] : ["collectif", "particulier"]) : [undefined];
    for (const f of formats) {
      const mine = seances.filter((s) => s.prestationId === p.id && (!p.hasFormat || (s.format ?? "collectif") === f));
      const past = mine.filter((s) => s.date <= today);
      const ref = past.length ? past : mine;
      const start = mode(ref.map((s) => s.start)) ?? (f === "collectif" ? "18:00" : "10:00");
      const dur = mode(ref.map((s) => toMin(s.end) - toMin(s.start)).filter((d) => d > 0)) ?? 60;
      const places = f === "collectif" ? (mode(ref.map((s) => s.places).filter((x): x is number => !!x)) ?? 6) : 1;
      cours.push({ key: coursKey(p.id, f), prestationId: p.id, format: f, label: coursLabel(p, f), price: p.price, places, start, dur, lieu: mode(ref.map((s) => s.lieu).filter((x): x is string => !!x)), uses: mine.length });
    }
  }
  cours.sort((a, b) => b.uses - a.uses);

  const events = [...(data.careEvents ?? [])].sort((a, b) => (a.date < b.date ? -1 : 1));
  const soins: SoinHabit[] = SOIN_LIST.map(([kind, label]) => {
    const mine = events.filter((e) => e.kind === kind);
    const priced = mine.filter((e) => e.cost && e.cost > 0);
    const last = priced[priced.length - 1];
    return {
      kind,
      label,
      price: last?.cost,
      start: mode(mine.map((e) => e.start).filter((x): x is string => !!x)) ?? "09:00",
      provider: [...mine].reverse().find((e) => e.provider)?.provider,
      uses: mine.length,
    };
  });
  soins.sort((a, b) => b.uses - a.uses);

  const titles: string[] = [];
  for (const t of [...(data.tasks ?? [])].reverse()) {
    const x = t.title.trim();
    if (x && !titles.some((y) => norm(y) === norm(x))) titles.push(x);
  }
  const quoi = [...titles, ...QUOI_SURS.filter((q) => !titles.some((y) => norm(y) === norm(q)))].slice(0, 3);
  return { cours, soins, quoi };
}

export interface DraftStart {
  date?: ISODate;
  start?: string;
  horseIds?: string[];
  prestationId?: string;
  care?: CareKind;
  amount?: number;
  sens?: "in" | "out";
  pour?: Pour;
}

/** Le brouillon d'un type, avec les réponses habituelles déjà cochées. */
export function draftFor(type: AjoutType, h: Habitudes, today: ISODate, p: DraftStart = {}): Draft {
  const d: Draft = {
    type,
    date: p.date ?? today,
    start: null,
    dur: 60,
    notes: "",
    qui: [],
    horseIds: p.horseIds ?? [],
    coursKey: null,
    custom: "",
    places: null,
    price: null,
    lieu: "",
    rep: "once",
    until: addDays(p.date ?? today, 84),
    cav: [],
    care: null,
    provider: "",
    refac: false,
    quoi: "",
    labels: [],
    end: "",
    rappel: "",
    sens: p.sens ?? "out",
    amount: p.amount ?? 0,
    pour: p.pour ?? (p.horseIds?.length ? "cheval" : "ecurie"),
    label: "",
    comment: "",
    moneyRep: "once",
  };
  if (type === "seance") {
    const c = h.cours.find((x) => x.prestationId === p.prestationId) ?? h.cours[0];
    if (c) applyCours(d, c);
    else d.start = "18:00";
    if (p.start) d.start = p.start;
  } else if (type === "soin") {
    const s = h.soins.find((x) => x.kind === p.care) ?? h.soins.find((x) => x.kind === "ferrure") ?? h.soins[0];
    if (s) applySoin(d, s);
    if (p.care && !s) d.care = p.care;
    if (p.amount) d.price = p.amount;
    if (p.start) d.start = p.start;
    d.refac = true;
  } else if (type === "rdv") {
    d.quoi = h.quoi[0] ?? "";
    d.start = p.start ?? null;
  } else {
    if (d.sens === "in" && d.pour === "ecurie") d.pour = "hors";
  }
  return d;
}

export function applyCours(d: Draft, c: CoursHabit) {
  d.coursKey = c.key;
  d.custom = "";
  d.price = c.price || null;
  d.places = c.format === "particulier" ? 1 : c.format === "collectif" ? c.places : null;
  d.start = c.start;
  d.dur = c.dur;
  d.lieu = c.lieu ?? d.lieu;
}

export function applySoin(d: Draft, s: SoinHabit) {
  d.care = s.kind;
  d.custom = "";
  d.price = s.price ?? null;
  d.start = s.start;
  d.provider = s.provider ?? "";
}

/** Ce qu'on a compris d'une phrase devient un brouillon, complété par les habitudes. */
export function draftFromCompris(c: Compris, h: Habitudes, today: ISODate): Draft {
  const d = draftFor(c.type, h, today, { date: c.date, horseIds: c.horseIds, care: c.care });
  if (c.type === "seance") {
    if (c.prestationId) {
      const k = h.cours.find((x) => x.key === coursKey(c.prestationId!, c.format)) ?? h.cours.find((x) => x.prestationId === c.prestationId);
      if (k) applyCours(d, k);
    } else if (c.coursName) {
      d.coursKey = null;
      d.custom = c.coursName;
      d.price = null;
      d.places = null;
    }
    if (c.places) d.places = c.places;
    if (c.amount) d.price = c.amount;
  } else if (c.type === "soin") {
    if (c.amount) d.price = c.amount;
  } else if (c.type === "rdv") {
    d.quoi = c.label ?? "";
    d.start = c.start ?? null;
    if (c.amount) d.price = c.amount;
    return d;
  } else {
    d.sens = c.sens ?? "out";
    d.amount = c.amount ?? 0;
    d.pour = c.pour ?? (c.horseIds.length ? "cheval" : "ecurie");
    d.label = c.label ?? "";
    return d;
  }
  if (c.start) d.start = c.start;
  return d;
}

/** Seul l'argent exige quelque chose : un montant. */
export const manque = (d: Draft) => d.type === "argent" && !(d.amount > 0);

/** Le nom de ce qu'on ajoute, tel qu'il apparaîtra au planning ou dans le mois. */
export function titre(d: Draft, h: Habitudes): string {
  if (d.type === "seance") return d.custom.trim() || h.cours.find((c) => c.key === d.coursKey)?.label || "Séance";
  if (d.type === "soin") return d.custom.trim() || SOIN_LIST.find(([k]) => k === d.care)?.[1] || "Soin";
  if (d.type === "rdv") return d.quoi.trim() || (d.start ? "Rendez-vous" : "Tâche");
  return d.label.trim() || (d.sens === "in" ? "Rentrée d’argent" : "Dépense");
}

/**
 * Les habitués d'une séance : ceux qui viennent aux séances passées du même
 * cours, au même créneau (jour de la semaine et heure) d'abord, puis au même
 * cours. Du plus fidèle au moins fidèle, sans ceux déjà inscrits.
 */
export function habitues(seances: Seance[], s: Seance, max = 6): string[] {
  const dow = (iso: string) => new Date(iso + "T12:00:00Z").getUTCDay();
  const already = new Set(s.participants.map((p) => p.personId));
  const score = new Map<string, number>();
  for (const x of seances) {
    if (x.id === s.id || x.prestationId !== s.prestationId || x.status === "cancelled") continue;
    const slot = dow(x.date) === dow(s.date) && x.start === s.start;
    for (const p of x.participants) {
      if (already.has(p.personId) || p.present === false) continue;
      score.set(p.personId, (score.get(p.personId) ?? 0) + (slot ? 10 : 1));
    }
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([id]) => id);
}
