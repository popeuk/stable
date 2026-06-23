import { describe, it, expect } from "vitest";
import {
  directExpenseToRow,
  horseToRow,
  revenueToRow,
  rowToDirectExpense,
  rowToHorse,
  rowToRevenue,
  sharedExpenseToRow,
  allocationsToRows,
} from "@/lib/data/sync/mappers";
import type { Horse, Revenue, DirectExpense, SharedExpense } from "@/lib/domain/types";

describe("mappers round-trip", () => {
  it("horse domain → row → domain", () => {
    const h: Horse = {
      id: "h1",
      stableId: "s1",
      name: "Belle",
      breed: "Connemara",
      birthYear: 2013,
      ownerName: "Sam",
      entryDate: "2022-01-01",
      exitDate: null,
      isArchived: false,
      pensionType: "Pension complète",
    };
    expect(rowToHorse(horseToRow(h))).toEqual(h);
  });

  it("revenue domain → row → domain", () => {
    const r: Revenue = {
      id: "r1",
      stableId: "s1",
      horseId: "h1",
      categoryId: "c1",
      amount: 600,
      date: "2024-02-05",
      source: "manual",
    };
    expect(rowToRevenue(revenueToRow(r))).toEqual(r);
  });

  it("direct expense domain → row → domain", () => {
    const e: DirectExpense = {
      id: "d1",
      stableId: "s1",
      horseId: "h1",
      label: "Véto",
      amount: 120,
      date: "2024-02-10",
      source: "photo",
      receiptUrl: null,
    };
    expect(rowToDirectExpense(directExpenseToRow(e))).toEqual(e);
  });

  it("maps a snake_case row to camelCase fields", () => {
    const row = horseToRow({
      id: "h1",
      stableId: "s1",
      name: "Sirius",
      entryDate: "2020-01-01",
      exitDate: null,
      isArchived: false,
    });
    expect(row.stable_id).toBe("s1");
    expect(row.entry_date).toBe("2020-01-01");
    expect(row.is_archived).toBe(false);
  });

  it("splits a shared expense into head + allocation rows", () => {
    const se: SharedExpense = {
      id: "se1",
      stableId: "s1",
      label: "Foin",
      totalAmount: 200,
      periodMonth: 2,
      periodYear: 2024,
      distributionMode: "equal",
      source: "manual",
      allocations: [
        { horseId: "h1", allocatedAmount: 100 },
        { horseId: "h2", allocatedAmount: 100, presenceDays: 29 },
      ],
    };
    expect(sharedExpenseToRow(se).total_amount).toBe(200);
    const rows = allocationsToRows(se);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ shared_expense_id: "se1", horse_id: "h1", allocated_amount: 100 });
    expect(rows[1].presence_days).toBe(29);
  });
});
