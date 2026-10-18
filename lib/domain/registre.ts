import type { CareEvent, CareKind } from "@/lib/domain/care";
import type { BillingInfo, Horse, ISODate, Person } from "@/lib/domain/types";
import { presentEntre, sejours } from "@/lib/domain/sejours";

/**
 * Le registre d'élevage (arrêté du 5 juin 2000) : obligatoire pour tout
 * détenteur d'équidés, quel que soit le nombre de chevaux. Tenu sur
 * ordinateur, il s'imprime chaque trimestre, à chaque visite vétérinaire et
 * sur demande lors d'un contrôle.
 *
 * Les rubriques suivent le « Guide pour l'élaboration du registre
 * d'élevage » de l'IFCE (SIRE) et son modèle :
 *  1. Caractéristiques du lieu de détention et du détenteur ;
 *  2. Encadrement zootechnique, sanitaire et médical (vétérinaires) ;
 *  3. Présence et caractéristiques des animaux (nom, SIRE, transpondeur,
 *     propriétaire, première entrée et provenance, sortie définitive et
 *     destination) ;
 *  4. Mouvements temporaires (concours, stages, sorties) ;
 *  5. Interventions et soins courants, dans l'ordre chronologique.
 *
 * Domaine pur, testé : l'écran assemble, il ne calcule rien.
 */

/** Le lieu de détention et son détenteur. Tout est facultatif. */
export interface Holding {
  /** Dénomination du lieu (le nom de l'écurie si vide). */
  placeName?: string;
  /** Adresse du lieu de détention. */
  placeAddress?: string;
  /** Type d'activité : pension, élevage, centre équestre… */
  activity?: string;
  /** Le détenteur : la personne ou la société qui a la garde des chevaux. */
  holderName?: string;
  /** Adresse du détenteur, si elle diffère du lieu. */
  holderAddress?: string;
  /** Téléphone et courriel du détenteur. */
  holderPhone?: string;
  holderEmail?: string;
  /** Le numéro de détenteur donné par le SIRE à la déclaration du lieu. */
  holderNumber?: string;
  /** Pour un professionnel : SIRET (et code APE). */
  siret?: string;
  /** Nom et coordonnées du vétérinaire traitant. */
  vetTraitant?: string;
  /** Nom et coordonnées du vétérinaire sanitaire (obligatoire dès 3 équidés). */
  vetSanitaire?: string;
}

export type HorseSex = "male" | "hongre" | "femelle";
export const SEX_LABEL: Record<HorseSex, string> = { male: "Mâle", hongre: "Hongre", femelle: "Femelle" };

export type PeriodKind = "trimestre" | "annee";
export interface RegisterPeriod {
  kind: PeriodKind;
  year: number;
  /** 1 à 4, pour un trimestre. */
  quarter?: number;
  start: ISODate;
  end: ISODate;
  label: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
/** Le tri naturel des noms : « Cheval 2 » avant « Cheval 10 ». */
export const parNom = (a: string, b: string) => a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" });
/** Un cheval du gérant lui-même (formule « À moi », components/bs/parcours.ts) : son propriétaire, c'est le détenteur. */
export const estAMoi = (h: Pick<Horse, "pensionType">) => h.pensionType === "À moi";
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export const quarterOf = (iso: ISODate) => Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1;

/** La période du registre : un trimestre (1 à 4) ou une année civile. */
export function registerPeriod(kind: PeriodKind, year: number, quarter = 1): RegisterPeriod {
  if (kind === "annee") return { kind, year, start: `${year}-01-01`, end: `${year}-12-31`, label: `Année ${year}` };
  const q = Math.min(4, Math.max(1, Math.round(quarter)));
  const m1 = (q - 1) * 3 + 1;
  const m3 = m1 + 2;
  const nom = ["", "1er", "2e", "3e", "4e"][q];
  return { kind, year, quarter: q, start: `${year}-${pad(m1)}-01`, end: `${year}-${pad(m3)}-${pad(lastDay(year, m3))}`, label: `${nom} trimestre ${year}` };
}

/** Le trimestre en cours, la période par défaut. */
export const currentQuarter = (today: ISODate) => registerPeriod("trimestre", Number(today.slice(0, 4)), quarterOf(today));

/**
 * Les équidés présents à un moment de la période : un de leurs séjours
 * (lib/domain/sejours) la chevauche. Un cheval parti depuis reste dans le
 * registre de la période où il était là ; un cheval parti puis revenu y
 * garde toute son histoire. Un cheval archivé sans date de départ (ancienne
 * donnée) est compté présent : mieux vaut une ligne de trop qu'un cheval
 * oublié dans un registre.
 *
 * La ligne de chaque cheval dit sa première entrée et sa provenance, et sa
 * sortie définitive à la fin de la période (s'il est parti sans revenir
 * avant la fin) avec sa destination. Les allers et retours de la période
 * sont dans les mouvements. Triés par première entrée.
 */
export function horsesPresent(horses: Horse[], start: ISODate, end: ISODate): Horse[] {
  return horses
    .filter((h) => presentEntre(h, start, end))
    .map((h) => ligneDuRegistre(h, end))
    .sort((a, b) => (a.entryDate === b.entryDate ? parNom(a.name, b.name) : a.entryDate < b.entryDate ? -1 : 1));
}

/** Le cheval tel que sa ligne du registre le montre, à la fin de la période. */
function ligneDuRegistre(h: Horse, end: ISODate): Horse {
  const all = sejours(h);
  const first = all[0];
  const last = all.filter((s) => !s.entry || s.entry <= end).at(-1) ?? first;
  const parti = !!last.exit && last.exit <= end;
  const row: Horse = { ...h, entryDate: first.entry, origin: first.origin, entryReason: first.entryReason, exitDate: parti ? last.exit : null, destination: parti ? last.destination : undefined, exitReason: parti ? last.exitReason : undefined };
  return row;
}

export interface Movement {
  date: ISODate;
  horseId: string;
  horseName: string;
  kind: "entree" | "sortie";
  /** Motif : achat, pension, naissance… ou vente, décès, fin de pension… */
  reason?: string;
  /** Provenance (entrée) ou destination (sortie). */
  place?: string;
}

/** Les entrées et sorties datées dans la période, séjour par séjour, dans l'ordre. */
export function movementsIn(horses: Horse[], start: ISODate, end: ISODate): Movement[] {
  const out: Movement[] = [];
  for (const h of horses)
    for (const s of sejours(h)) {
      if (s.entry && s.entry >= start && s.entry <= end) out.push({ date: s.entry, horseId: h.id, horseName: h.name, kind: "entree", reason: s.entryReason, place: s.origin });
      if (s.exit && s.exit >= start && s.exit <= end) out.push({ date: s.exit, horseId: h.id, horseName: h.name, kind: "sortie", reason: s.exitReason, place: s.destination });
    }
  return out.sort((a, b) => (a.date === b.date ? (a.kind === b.kind ? parNom(a.horseName, b.horseName) : a.kind === "entree" ? -1 : 1) : a.date < b.date ? -1 : 1));
}

/**
 * Ce que le registre retient du carnet : l'entretien des animaux, les soins
 * et les interventions (vaccins, vermifuges, vétérinaire, soins, dentiste,
 * ostéopathe, maréchal). Les cours, l'entraînement, les prestations et les
 * documents n'y vont pas.
 */
export const REGISTER_CARE: CareKind[] = ["vaccin", "vermifuge", "veto", "soin", "dentiste", "osteo", "ferrure"];
/** Les sorties qui sont des mouvements temporaires (rubrique 4). */
export const TEMPORARY_KINDS: CareKind[] = ["concours"];

const done = (e: CareEvent, today: ISODate) => !e.pending && e.date <= today;

/**
 * Les soins et traitements faits pendant la période, en ordre chronologique
 * (option 2 du modèle IFCE, tous les chevaux sur le même tableau). Un rendez-
 * vous à venir n'est pas un soin fait : il n'y figure pas.
 */
export function careInPeriod(events: CareEvent[] | undefined, start: ISODate, end: ISODate, today: ISODate): CareEvent[] {
  return (events ?? [])
    .filter((e) => REGISTER_CARE.includes(e.kind) && done(e, today) && e.date >= start && e.date <= end)
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? -1 : 1));
}

/** Les sorties temporaires connues (concours) pendant la période. */
export function temporaryInPeriod(events: CareEvent[] | undefined, start: ISODate, end: ISODate, today: ISODate): CareEvent[] {
  return (events ?? [])
    .filter((e) => TEMPORARY_KINDS.includes(e.kind) && done(e, today) && e.date >= start && e.date <= end)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Ce qu'il manque à la fiche d'un cheval pour sa ligne du registre. */
export type HorseGap = "sire" | "puce" | "proprietaire" | "provenance" | "destination";
export const GAP_LABEL: Record<HorseGap, string> = {
  sire: "Numéro SIRE à compléter",
  puce: "Numéro de puce à compléter",
  proprietaire: "Propriétaire à compléter",
  provenance: "Provenance à compléter",
  destination: "Destination à compléter",
};

export function horseGaps(h: Horse): HorseGap[] {
  const g: HorseGap[] = [];
  if (!h.sireNumber?.trim()) g.push("sire");
  if (!h.chipNumber?.trim()) g.push("puce");
  // Un cheval du gérant a son propriétaire : le gérant.
  if (!h.ownerName?.trim() && !estAMoi(h)) g.push("proprietaire");
  if (!h.origin?.trim()) g.push("provenance");
  if (h.exitDate && !h.destination?.trim()) g.push("destination");
  return g;
}

/**
 * Ce qu'il manque au lieu de détention. Le vétérinaire sanitaire compte dès 3 équidés :
 * « vétérinaire désigné au Préfet par tous les détenteurs d'au moins 3 équidés »
 * (arrêté du 19 septembre 2018, NOR AGRG1821873A, JO du 26/09/2018).
 */
export type HoldingGap = "lieu" | "detenteur" | "numero" | "veto_sanitaire";
export const HOLDING_GAP_LABEL: Record<HoldingGap, string> = {
  lieu: "Adresse du lieu à compléter",
  detenteur: "Nom du détenteur à compléter",
  numero: "Numéro de détenteur à compléter",
  veto_sanitaire: "Vétérinaire sanitaire à compléter",
};

export function holdingGaps(h: Holding | undefined, nHorses: number): HoldingGap[] {
  const g: HoldingGap[] = [];
  if (!h?.placeAddress?.trim()) g.push("lieu");
  if (!h?.holderName?.trim()) g.push("detenteur");
  if (!h?.holderNumber?.trim()) g.push("numero");
  if (nHorses >= 3 && !h?.vetSanitaire?.trim()) g.push("veto_sanitaire");
  return g;
}

/** Le gérant tel que le registre le nomme pour ses propres chevaux : nom, adresse, téléphone, courriel. */
export interface Detenteur {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

/** Une adresse sur une ligne du tableau : « 3 allée des Saules, 72000 Le Mans ». */
const surUneLigne = (a?: string) => (a ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean).join(", ");

/**
 * Les coordonnées du propriétaire : son nom, puis son adresse, son
 * téléphone et son courriel lus sur sa fiche client (nom à la casse et aux
 * espaces près). Un cheval du gérant (« À moi ») sans propriétaire noté a
 * pour propriétaire le détenteur.
 */
export function ownerLine(h: Horse, people: Person[] | undefined, moi?: Detenteur): string {
  const name = h.ownerName?.trim();
  if (!name) return estAMoi(h) && moi?.name.trim() ? [moi.name.trim(), surUneLigne(moi.address), moi.phone, moi.email].filter(Boolean).join(", ") : "";
  const k = name.replace(/\s+/g, " ").toLowerCase();
  const p = (people ?? []).find((x) => x.name.trim().replace(/\s+/g, " ").toLowerCase() === k);
  return [name, surUneLigne(p?.address), p?.phone, p?.email].filter(Boolean).join(", ");
}

/** Le nom générique d'une écurie pas encore nommée : jamais imprimé comme dénomination. */
const SANS_NOM = /^mon [ée]curie$/i;

/**
 * La dénomination du lieu : celle notée pour le registre, sinon le nom de
 * facturation (celui des factures), sinon le nom de l'écurie s'il est choisi.
 */
export function denomination(holding: Holding | undefined, billing: Pick<BillingInfo, "legalName"> | undefined, stableName: string | undefined): string {
  const n = (stableName ?? "").trim();
  return holding?.placeName?.trim() || billing?.legalName?.trim() || (n && !SANS_NOM.test(n) ? n : "");
}

/** Le détenteur : celui noté pour le registre, sinon le nom de facturation, sinon le gérant ; ses coordonnées suivent. */
export function detenteurDe(holding: Holding | undefined, billing: Pick<BillingInfo, "legalName" | "address"> | undefined, gerant: string | undefined): Detenteur {
  return {
    name: holding?.holderName?.trim() || billing?.legalName?.trim() || (gerant ?? "").trim(),
    address: holding?.holderAddress?.trim() || holding?.placeAddress?.trim() || billing?.address?.trim() || undefined,
    phone: holding?.holderPhone?.trim() || undefined,
    email: holding?.holderEmail?.trim() || undefined,
  };
}

/** L'identifiant affiché : la date de naissance si connue, sinon l'année. */
export function birthLabel(h: Horse): string {
  if (h.birthDate) return new Date(h.birthDate + "T12:00:00").toLocaleDateString("fr-FR");
  return h.birthYear ? String(h.birthYear) : "";
}

export interface Register {
  period: RegisterPeriod;
  horses: Horse[];
  movements: Movement[];
  temporary: CareEvent[];
  care: CareEvent[];
}

/** Tout le registre d'une période, assemblé à partir de ce que l'app sait. */
export function buildRegister(data: { horses: Horse[]; careEvents?: CareEvent[] }, period: RegisterPeriod, today: ISODate): Register {
  const horses = horsesPresent(data.horses, period.start, period.end);
  const ids = new Set(horses.map((h) => h.id));
  const ofPresent = (e: CareEvent) => ids.has(e.horseId);
  return {
    period,
    horses,
    movements: movementsIn(data.horses, period.start, period.end),
    temporary: temporaryInPeriod(data.careEvents, period.start, period.end, today).filter(ofPresent),
    care: careInPeriod(data.careEvents, period.start, period.end, today).filter(ofPresent),
  };
}

/**
 * L'accord d'un cheval : une jument au féminin, un mâle ou un hongre au
 * masculin ; sexe inconnu : la tournure neutre (« ce cheval », ou son nom).
 */
export function selonSexe<T>(h: { sex?: HorseSex }, masc: T, fem: T, neutre: T): T {
  return h.sex === "femelle" ? fem : h.sex ? masc : neutre;
}
