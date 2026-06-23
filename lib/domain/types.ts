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

/** The full bundle of data the domain functions operate on. */
export interface StableData {
  horses: Horse[];
  revenues: Revenue[];
  directExpenses: DirectExpense[];
  sharedExpenses: SharedExpense[];
  revenueCategories: Category[];
  expenseCategories: Category[];
}
