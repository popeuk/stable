/**
 * Domain types for Be Stable.
 *
 * These mirror the PostgreSQL schema in section 4 of the spec but use
 * camelCase and the shape the client actually works with. The data layer
 * is responsible for mapping snake_case rows to/from these types.
 */

export type EntrySource = "manual" | "voice" | "photo" | "recurring";
export type DistributionMode = "equal" | "weighted_by_days";
export type StableType =
  | "pension_simple"
  | "ecurie_active"
  | "centre_equestre"
  | "mixte";

/** ISO date string, `YYYY-MM-DD`. */
export type ISODate = string;

export interface Horse {
  id: string;
  stableId: string;
  name: string;
  breed?: string;
  birthYear?: number;
  ownerName?: string;
  entryDate: ISODate;
  exitDate?: ISODate | null;
  isArchived: boolean;
  pensionType?: string;
  /**
   * Le contrat de pension (€/mois). Renseigné, il est posté automatiquement
   * chaque mois en revenu : le loyer d'une place ne se ressaisit jamais.
   */
  pension?: number;
  notes?: string;
  /** Optional accent colour seed for the monogram placeholder. */
  photoUrl?: string | null;
  /** La robe (alezan, bai, noir, gris, isabelle, pie) : le portrait du cheval. */
  coat?: string;
  /** Une liste en tête : le détail du portrait. */
  blaze?: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  /** For expense categories: a direct (true) vs mutualised (false) cost. */
  isDirect?: boolean;
}

export interface Revenue {
  id: string;
  stableId: string;
  horseId: string;
  categoryId?: string;
  amount: number;
  date: ISODate;
  note?: string;
  source: EntrySource;
  /** Qui paie : le nom d'une personne. Absent = le propriétaire du cheval. */
  payer?: string;
  /** La séance d'origine, quand la recette vient d'une validation. */
  seanceId?: string;
  /** La dépense refacturée dont cette recette est le pendant. */
  rebillOf?: string;
}

export interface DirectExpense {
  id: string;
  stableId: string;
  horseId: string;
  categoryId?: string;
  label: string;
  amount: number;
  date: ISODate;
  note?: string;
  source: EntrySource;
  receiptUrl?: string | null;
  /** Refacturée au propriétaire : une recette du même montant existe. */
  rebillRevenueId?: string;
}

export interface SharedExpenseAllocation {
  horseId: string;
  allocatedAmount: number;
  presenceDays?: number;
}

export interface SharedExpense {
  id: string;
  stableId: string;
  categoryId?: string;
  label: string;
  totalAmount: number;
  periodMonth: number; // 1-12
  periodYear: number;
  distributionMode: DistributionMode;
  source: EntrySource;
  allocations: SharedExpenseAllocation[];
  note?: string;
}

/** A calendar period the whole app is scoped to (the Time Ribbon). */
export interface Period {
  year: number;
  month: number; // 1-12
}

/** The full computed P&L for one horse over one period. */
export interface HorsePnl {
  horseId: string;
  revenue: number;
  directCosts: number;
  sharedCosts: number;
  /** directCosts + sharedCosts — the break-even revenue. */
  threshold: number;
  /** revenue - directCosts - sharedCosts. */
  netResult: number;
  /** netResult / revenue * 100, or 0 when there is no revenue. */
  netMarginPct: number;
  /** revenue - directCosts. */
  grossMargin: number;
}

export type Trend = "hausse" | "baisse" | "stable";

export type Frequency = "monthly" | "quarterly" | "yearly";

/**
 * A recurring charge template (a loan, a subscription, the insurance…). It
 * generates a charge each due period between startDate and endDate. Can be
 * direct (one horse) or shared across the stable.
 */
export interface RecurringExpense {
  id: string;
  stableId: string;
  label: string;
  amount: number; // per occurrence
  categoryId?: string;
  isShared: boolean;
  horseId?: string; // when direct
  distributionMode?: DistributionMode; // when shared
  frequency: Frequency;
  startDate: ISODate;
  endDate?: ISODate | null;
  source: EntrySource;
}

/**
 * A recurring revenue template — typically a pension (recurring by nature).
 * Always tied to one horse.
 */
export interface RecurringRevenue {
  id: string;
  stableId: string;
  horseId: string;
  categoryId?: string;
  label?: string;
  amount: number;
  frequency: Frequency;
  startDate: ISODate;
  endDate?: ISODate | null;
  source: EntrySource;
}

/** The schedule fields common to recurring entries. */
export interface RecurringSchedule {
  startDate: ISODate;
  endDate?: ISODate | null;
  frequency: Frequency;
}

/**
 * Une prestation libre définie par le gérant : balade, transport, douche,
 * débourrage… Son prix préremplit la recette quand on l'ajoute au planning.
 */
export interface Service {
  id: string;
  name: string;
  /** Recette par cheval (optionnelle : vide = prix libre à chaque fois). */
  price?: number;
}

/** L'équipe de l'écurie : employés et prestataires réguliers. */
export type TeamRole = "employe" | "prestataire";
export interface TeamMember {
  id: string;
  name: string;
  role: TeamRole;
  /** « Monitrice », « Maréchal-ferrant »… */
  job?: string;
}

/**
 * La grille tarifaire de l'écurie : saisie UNE fois dans Réglages, elle
 * préremplit les prix partout (composeur, vocal, nouveau cheval) — et
 * chaque prix reste modifiable au cas par cas, rien n'est verrouillé.
 */
export interface Tariffs {
  /** Pension par défaut d'un nouveau cheval (€/mois). */
  pension?: number;
  /** Cours collectif, recette par cavalier. */
  cours_collectif?: number;
  /** Cours individuel. */
  cours_individuel?: number;
  /** Séance de travail du cheval facturée au propriétaire. */
  entrainement?: number;
}

import type { CareEvent } from "@/lib/domain/care";
import type { Rhythm } from "@/lib/domain/rhythm";

/**
 * Une personne de l'écurie : propriétaire d'un cheval en pension ou
 * cavalier qui prend des cours. C'est à elle qu'on facture.
 */
export type PersonRole = "proprietaire" | "cavalier";
export interface Person {
  id: string;
  name: string;
  role: PersonRole;
  phone?: string;
  active: boolean;
}

/** Une prestation vendue (cours, travail du cheval, balade…), avec son prix. */
export interface Prestation {
  id: string;
  label: string;
  /** Prix par cavalier présent (ou par séance pour un travail du cheval). */
  price: number;
  /** Seul le cours d'équitation a un format particulier ou collectif. */
  hasFormat?: boolean;
  active: boolean;
}

export type SeanceStatus = "planned" | "done" | "cancelled";
export type SeanceFormat = "particulier" | "collectif";

/** Un participant : qui monte, sur quel cheval, présent ou non. */
export interface Participant {
  personId: string;
  horseId?: string;
  /** Renseigné à la validation. Absent = pas encore pointé. */
  present?: boolean;
}

/**
 * Une séance du planning (repris du planning des cours du Clos) : une
 * prestation à une date et une heure, des participants, un statut. Une
 * séance faite met l'argent sur les tickets ; son prix est figé.
 */
export interface Seance {
  id: string;
  prestationId: string;
  title: string;
  format?: SeanceFormat;
  places?: number;
  participants: Participant[];
  /** Les chevaux concernés quand la séance ne porte pas de cavalier (travail). */
  horseIds: string[];
  date: ISODate;
  start: string; // HH:MM
  end: string; // HH:MM
  lieu?: string;
  notes?: string;
  status: SeanceStatus;
  cancelReason?: string;
  /** Prix unitaire figé à la création : changer un tarif ne réécrit pas le passé. */
  unitPrice: number;
  seriesId?: string;
  /** Facturer un absent qui n'a pas prévenu. */
  chargeAbsent?: boolean;
  updatedBy?: string;
  rev: number;
}

/** Le tableau d'équipe (repris du Clos) : colonnes et cartes. */
export interface TaskList {
  id: string;
  title: string;
  isDone?: boolean;
}
/** Une tâche (à faire) ou un rendez-vous (un jour, une heure). Absent = tâche. */
export type TaskKind = "tache" | "rdv";
export interface TeamTask {
  id: string;
  title: string;
  /** Tâche ou rendez-vous. Les anciennes cartes n'ont pas ce champ : ce sont des tâches. */
  kind?: TaskKind;
  /** Rendez-vous : l'heure de fin (HH:MM), facultative. Le début est dans `due`. */
  end?: string;
  /** Rendez-vous : le lieu ou la personne, facultatif. */
  lieu?: string;
  listId: string;
  labels: string[];
  due?: string; // AAAA-MM-JJTHH:MM
  forWho: string[];
  notes?: string;
  checklist: { id: string; text: string; done: boolean }[];
  comments: { by: string; at: string; text: string }[];
  /** Un coût : devient une facture commune quand la carte passe en « Fait ». */
  cost?: number;
  costExpenseId?: string;
  createdBy?: string;
  sort: number;
}

/** Une action de rentabilité suivie : proposée, en cours, faite. */
export type ActionStatus = "proposee" | "en_cours" | "faite" | "ecartee";
export interface ActionState {
  id: string;
  status: ActionStatus;
  at: string;
  /** Ce que l'action a rapporté, mesuré quand elle est faite. */
  measured?: number;
}

/** Un paiement reçu d'une personne pour un mois. */
export interface Payment {
  id: string;
  payer: string;
  month: string; // AAAA-MM
  amount: number;
  at: string;
}

/** The full bundle of data the domain functions operate on. */
export interface StableData {
  horses: Horse[];
  revenues: Revenue[];
  directExpenses: DirectExpense[];
  sharedExpenses: SharedExpense[];
  revenueCategories: Category[];
  expenseCategories: Category[];
  /** Recurring charge templates (optional — folded into period figures). */
  recurringExpenses?: RecurringExpense[];
  /** Recurring revenue templates, e.g. pensions (folded into period figures). */
  recurringRevenues?: RecurringRevenue[];
  /** Le carnet de vie : soins, santé, sport, documents (voir domain/care). */
  careEvents?: CareEvent[];
  /** Les rythmes hebdomadaires : le planning qui se remplit tout seul. */
  rhythms?: Rhythm[];
  /** La grille tarifaire : les prix par défaut, préremplis partout. */
  tariffs?: Tariffs;
  /** Les prestations libres du gérant (balade, transport…). */
  services?: Service[];
  /** L'équipe : employés et prestataires, assignables aux tâches. */
  team?: TeamMember[];
  people?: Person[];
  prestations?: Prestation[];
  seances?: Seance[];
  taskLists?: TaskList[];
  tasks?: TeamTask[];
  actions?: ActionState[];
  payments?: Payment[];
}
