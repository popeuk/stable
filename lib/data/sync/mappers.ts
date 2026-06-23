/**
 * Pure mappers between the domain (camelCase) and Postgres rows (snake_case).
 * Used by the remote repository; isolated here so they can be unit-tested.
 */
import type {
  DirectExpense,
  Horse,
  Revenue,
  SharedExpense,
} from "@/lib/domain/types";

export function horseToRow(h: Horse): Record<string, unknown> {
  return {
    id: h.id,
    stable_id: h.stableId,
    name: h.name,
    breed: h.breed ?? null,
    birth_year: h.birthYear ?? null,
    owner_name: h.ownerName ?? null,
    entry_date: h.entryDate,
    exit_date: h.exitDate ?? null,
    is_archived: h.isArchived,
    pension_type: h.pensionType ?? null,
    notes: h.notes ?? null,
  };
}

export function rowToHorse(r: Record<string, unknown>): Horse {
  return {
    id: r.id as string,
    stableId: r.stable_id as string,
    name: r.name as string,
    breed: (r.breed as string) ?? undefined,
    birthYear: (r.birth_year as number) ?? undefined,
    ownerName: (r.owner_name as string) ?? undefined,
    entryDate: r.entry_date as string,
    exitDate: (r.exit_date as string) ?? null,
    isArchived: Boolean(r.is_archived),
    pensionType: (r.pension_type as string) ?? undefined,
    notes: (r.notes as string) ?? undefined,
  };
}

export function revenueToRow(r: Revenue): Record<string, unknown> {
  return {
    id: r.id,
    stable_id: r.stableId,
    horse_id: r.horseId,
    category_id: r.categoryId ?? null,
    amount: r.amount,
    date: r.date,
    note: r.note ?? null,
    source: r.source,
  };
}

export function rowToRevenue(r: Record<string, unknown>): Revenue {
  return {
    id: r.id as string,
    stableId: r.stable_id as string,
    horseId: r.horse_id as string,
    categoryId: (r.category_id as string) ?? undefined,
    amount: Number(r.amount),
    date: r.date as string,
    note: (r.note as string) ?? undefined,
    source: r.source as Revenue["source"],
  };
}

export function directExpenseToRow(e: DirectExpense): Record<string, unknown> {
  return {
    id: e.id,
    stable_id: e.stableId,
    horse_id: e.horseId,
    category_id: e.categoryId ?? null,
    label: e.label,
    amount: e.amount,
    date: e.date,
    note: e.note ?? null,
    source: e.source,
    receipt_url: e.receiptUrl ?? null,
  };
}

export function rowToDirectExpense(r: Record<string, unknown>): DirectExpense {
  return {
    id: r.id as string,
    stableId: r.stable_id as string,
    horseId: r.horse_id as string,
    categoryId: (r.category_id as string) ?? undefined,
    label: r.label as string,
    amount: Number(r.amount),
    date: r.date as string,
    note: (r.note as string) ?? undefined,
    source: r.source as DirectExpense["source"],
    receiptUrl: (r.receipt_url as string) ?? null,
  };
}

/** Shared expense head row (allocations are persisted separately). */
export function sharedExpenseToRow(s: SharedExpense): Record<string, unknown> {
  return {
    id: s.id,
    stable_id: s.stableId,
    category_id: s.categoryId ?? null,
    label: s.label,
    total_amount: s.totalAmount,
    period_month: s.periodMonth,
    period_year: s.periodYear,
    distribution_mode: s.distributionMode,
    source: s.source,
    note: s.note ?? null,
  };
}

export function allocationsToRows(s: SharedExpense): Record<string, unknown>[] {
  return s.allocations.map((a) => ({
    shared_expense_id: s.id,
    horse_id: a.horseId,
    allocated_amount: a.allocatedAmount,
    presence_days: a.presenceDays ?? null,
  }));
}
