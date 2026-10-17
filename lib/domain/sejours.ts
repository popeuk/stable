import type { Horse, ISODate, Period } from "@/lib/domain/types";
import { daysInMonth, periodEnd, periodStart } from "@/lib/utils/period";

/**
 * Les séjours d'un cheval à l'écurie. Un cheval qui part puis revient garde
 * toute son histoire : chaque séjour a son entrée datée (et sa provenance),
 * sa sortie datée (et sa destination). Un retour ajoute un séjour, il ne
 * touche jamais aux précédents.
 *
 * Deux jeux de dates par séjour :
 *  - les dates réelles (`entry`, `exit`), pour le registre d'élevage ;
 *  - les dates où il compte dans l'argent (`countFrom`, `countUntil`), pour
 *    la pension, sa part des frais communs et ses tickets.
 *
 * La règle, dite au gérant à la saisie : les mois d'avant ce mois-ci sont
 * déjà comptés (et peut-être facturés), ils ne bougent jamais. Une date
 * passée (arrivée, départ, retour) va telle quelle au registre ; dans
 * l'argent, elle compte à partir de ce mois-ci. Sans `countFrom` ni
 * `countUntil`, les deux jeux de dates sont les mêmes.
 *
 * Les champs `entryDate`, `exitDate`, `origin`, `entryReason`,
 * `destination`, `exitReason` et `isArchived` du cheval restent le reflet du
 * dernier séjour (`avecSejours`), pour la synchro et les écrans d'avant.
 * Domaine pur, testé.
 */
export interface Stay {
  /** Jour d'arrivée réel (registre). */
  entry: ISODate;
  /** Jour de départ réel (registre). Absent : il est encore là. */
  exit?: ISODate | null;
  /** Il compte dans l'argent à partir de ce jour (défaut : `entry`). */
  countFrom?: ISODate;
  /** Il compte dans l'argent jusqu'à ce jour (défaut : `exit`). */
  countUntil?: ISODate | null;
  /** Provenance et motif d'arrivée. */
  origin?: string;
  entryReason?: string;
  /** Destination et motif de départ. */
  destination?: string;
  exitReason?: string;
}

type HorseLike = Pick<Horse, "entryDate" | "exitDate" | "isArchived"> & Partial<Pick<Horse, "stays" | "origin" | "entryReason" | "destination" | "exitReason">>;

const propre = (s: Stay): Stay => {
  const o: Stay = { entry: s.entry };
  if (s.exit) o.exit = s.exit;
  if (s.countFrom && s.countFrom !== s.entry) o.countFrom = s.countFrom;
  if (s.countUntil !== undefined && s.countUntil !== (s.exit ?? null)) o.countUntil = s.countUntil;
  for (const k of ["origin", "entryReason", "destination", "exitReason"] as const) if (s[k]?.trim()) o[k] = s[k]!.trim();
  return o;
};

/**
 * Les séjours du cheval, du plus ancien au plus récent. Un cheval d'avant
 * les séjours en a un seul, fait de ses dates d'arrivée et de départ. Un
 * cheval archivé sans date de départ (très ancienne donnée) ne compte plus
 * dans l'argent, mais reste présent au registre : mieux vaut une ligne de
 * trop qu'un cheval oublié.
 */
export function sejours(h: HorseLike): Stay[] {
  if (h.stays?.length) return h.stays;
  const s: Stay = { entry: h.entryDate ?? "", exit: h.exitDate ?? null, origin: h.origin, entryReason: h.entryReason, destination: h.destination, exitReason: h.exitReason };
  if (h.isArchived && !h.exitDate) s.countUntil = "";
  return [s];
}

/** Le séjour en cours, ou le dernier. */
export const dernierSejour = (h: HorseLike): Stay => sejours(h).at(-1)!;
/** La toute première entrée (« Première entrée » du registre). */
export const premiereEntree = (h: HorseLike): ISODate => sejours(h)[0]?.entry ?? h.entryDate;

export const debutCompte = (s: Stay): ISODate => s.countFrom ?? s.entry ?? "";
export const finCompte = (s: Stay): ISODate | null => (s.countUntil !== undefined ? s.countUntil : (s.exit ?? null));

/**
 * Le cheval avec ces séjours : les champs d'avant (arrivée, départ,
 * provenance, destination, parti ou non) reflètent le dernier séjour.
 */
export function avecSejours<T extends Horse>(h: T, stays: Stay[]): T {
  const list = stays.map(propre);
  const last = list.at(-1)!;
  const next: T = {
    ...h,
    stays: list,
    entryDate: last.entry,
    exitDate: last.exit ?? null,
    isArchived: !!last.exit,
    origin: last.origin,
    entryReason: last.entryReason,
    destination: last.destination,
    exitReason: last.exitReason,
  };
  for (const k of ["origin", "entryReason", "destination", "exitReason"] as const) if (!next[k]) delete next[k];
  return next;
}

/** La migration douce : chaque cheval reçoit ses séjours, faits de ses dates d'avant. */
export function donnerSejours<T extends Horse>(h: T): T {
  if (h.stays?.length) return h;
  return avecSejours(h, sejours(h));
}

/* ---------- La règle de l'argent ---------- */

/** Le premier jour du mois de `today`. */
const debutDuMois = (today: ISODate) => `${today.slice(0, 7)}-01`;
/** La veille d'un jour. */
export function veille(d: ISODate): ISODate {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}
export function lendemain(d: ISODate): ISODate {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

/**
 * À partir de quand un cheval arrivé (ou revenu) le jour `entry` compte dans
 * l'argent, noté le jour `today` : sa date si elle est de ce mois-ci (ou à
 * venir), sinon le premier jour de ce mois-ci. Les mois d'avant ne bougent pas.
 */
export function compteDepuis(entry: ISODate, today: ISODate): ISODate {
  const m = debutDuMois(today);
  return entry && entry >= m ? entry : m;
}

/**
 * Jusqu'à quand un cheval parti le jour `exit`, noté le jour `today`, compte
 * dans l'argent : sa date si elle est de ce mois-ci, sinon la veille de ce
 * mois-ci (le mois de son départ est déjà compté, il ne bouge pas).
 */
export function compteJusquA(exit: ISODate, today: ISODate): ISODate {
  const m = debutDuMois(today);
  return exit >= m ? exit : veille(m);
}

/* ---------- Présence ---------- */

/** Le séjour chevauche-t-il [start, end] dans l'argent ? */
const chevaucheArgent = (s: Stay, start: ISODate, end: ISODate) => {
  const f = finCompte(s);
  return debutCompte(s) <= end && (f === null || f >= start);
};
/** Le séjour chevauche-t-il [start, end] pour le registre ? */
const chevaucheRegistre = (s: Stay, start: ISODate, end: ISODate) => {
  const e = s.exit ?? null;
  return (!s.entry || s.entry <= end) && (e === null || e >= start);
};

/** Compte-t-il dans l'argent au moins un jour entre `start` et `end` ? */
export function compteEntre(h: HorseLike, start: ISODate, end: ISODate): boolean {
  return sejours(h).some((s) => chevaucheArgent(s, start, end));
}
/** Était-il à l'écurie au moins un jour entre `start` et `end` (registre) ? */
export function presentEntre(h: HorseLike, start: ISODate, end: ISODate): boolean {
  return sejours(h).some((s) => chevaucheRegistre(s, start, end));
}
/** Compte-t-il dans l'argent ce jour-là ? */
export const compteLe = (h: HorseLike, d: ISODate) => compteEntre(h, d, d);

/** Le séjour (argent) qui couvre une partie du mois, le premier. */
export function sejourDuMois(h: HorseLike, p: Period): Stay | undefined {
  return sejours(h).find((s) => chevaucheArgent(s, periodStart(p), periodEnd(p)));
}

/** Les jours où il compte dans le mois, tous séjours confondus (bornes incluses). */
export function joursDansLeMois(h: HorseLike, p: Period): number {
  const ms = periodStart(p);
  const me = periodEnd(p);
  let n = 0;
  for (const s of sejours(h)) {
    if (!chevaucheArgent(s, ms, me)) continue;
    const from = debutCompte(s) > ms ? debutCompte(s) : ms;
    const f = finCompte(s);
    const to = f !== null && f < me ? f : me;
    if (to < from) continue;
    n += Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86_400_000) + 1;
  }
  return Math.min(n, daysInMonth(p));
}

/* ---------- Départ et retour ---------- */

export interface InfosSortie {
  destination?: string;
  exitReason?: string;
}
export interface InfosEntree {
  origin?: string;
  entryReason?: string;
}

/**
 * Le cheval quitte l'écurie le jour `date` (aujourd'hui par défaut, passé
 * possible, jamais avant son arrivée ni après aujourd'hui). Le séjour en
 * cours se ferme ; les précédents ne bougent pas.
 */
export function partirLe<T extends Horse>(h: T, date: ISODate, today: ISODate, infos: InfosSortie = {}): T {
  const stays = sejours(h).map((s) => ({ ...s }));
  const cur = stays.at(-1)!;
  if (cur.exit) return h;
  const d = borne(date, cur.entry, today);
  cur.exit = d;
  const until = compteJusquA(d, today);
  // Jamais avant le jour où il a commencé à compter.
  cur.countUntil = until < debutCompte(cur) ? veille(debutCompte(cur)) : until;
  if (infos.destination?.trim()) cur.destination = infos.destination;
  if (infos.exitReason?.trim()) cur.exitReason = infos.exitReason;
  return avecSejours(h, stays);
}

/**
 * Un cheval parti revient le jour `date` (aujourd'hui par défaut, passé
 * possible, jamais avant son départ). Un retour le jour même ou le
 * lendemain d'un départ de ce mois-ci, c'est un départ noté par erreur (ou
 * une sortie d'un jour) : le séjour reprend comme avant. Sinon un nouveau
 * séjour commence, avec sa provenance ; les précédents ne bougent pas.
 */
export function revenirLe<T extends Horse>(h: T, date: ISODate, today: ISODate, infos: InfosEntree = {}): T {
  const stays = sejours(h).map((s) => ({ ...s }));
  const cur = stays.at(-1)!;
  if (!cur.exit) return h;
  const d = borne(date, cur.exit, today);
  if (d <= lendemain(cur.exit) && cur.exit >= debutDuMois(today)) {
    delete cur.exit;
    delete cur.countUntil;
    delete cur.destination;
    delete cur.exitReason;
    return avecSejours(h, stays);
  }
  const s: Stay = { entry: d, countFrom: compteDepuis(d, today) };
  if (infos.origin?.trim()) s.origin = infos.origin;
  if (infos.entryReason?.trim()) s.entryReason = infos.entryReason;
  // Revenu le jour où le séjour d'avant compte encore : il compte dès le lendemain, sans double compte.
  const f = finCompte(cur);
  if (f && debutCompte(s) <= f) s.countFrom = lendemain(f);
  return avecSejours(h, [...stays, s]);
}

/**
 * La date d'arrivée du séjour en cours, corrigée sur sa fiche. Le registre
 * prend la date telle quelle ; dans l'argent, les mois d'avant ce mois-ci ne
 * bougent pas (déjà comptés), seul ce mois-ci suit la nouvelle date.
 */
export function changerArrivee<T extends Horse>(h: T, entry: ISODate, today: ISODate): T {
  const stays = sejours(h).map((s) => ({ ...s }));
  const cur = stays.at(-1)!;
  if (!entry || entry === cur.entry) return h;
  const m = debutDuMois(today);
  const avant = debutCompte(cur);
  cur.entry = entry;
  if (avant < m) cur.countFrom = avant;
  else cur.countFrom = compteDepuis(entry, today);
  // Jamais avant la fin du séjour d'avant.
  const prev = stays.at(-2);
  const pf = prev ? finCompte(prev) : null;
  if (pf && cur.countFrom! <= pf) cur.countFrom = lendemain(pf);
  return avecSejours(h, stays);
}

/** Les infos d'identité d'un séjour (provenance, destination, motifs) : celles du séjour en cours. */
export function changerInfosSejour<T extends Horse>(h: T, patch: InfosEntree & InfosSortie): T {
  const stays = sejours(h).map((s) => ({ ...s }));
  const cur = stays.at(-1)!;
  for (const k of ["origin", "entryReason", "destination", "exitReason"] as const) {
    if (!(k in patch)) continue;
    const v = patch[k]?.trim();
    if (v) cur[k] = v;
    else delete cur[k];
  }
  return avecSejours(h, stays);
}

const borne = (d: ISODate, min: ISODate, max: ISODate) => {
  let x = d || max;
  if (x > max) x = max;
  if (min && x < min) x = min;
  return x;
};

/** « du 1 avril 2024 au 17 octobre 2026 » : un séjour dit en mots. */
export function sejourEnMots(s: Stay): string {
  const j = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return s.exit ? `du ${j(s.entry)} au ${j(s.exit)}` : `depuis le ${j(s.entry)}`;
}
