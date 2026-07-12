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
}
