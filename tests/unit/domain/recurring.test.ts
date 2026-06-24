import { describe, it, expect } from "vitest";
import { recurringDue } from "@/lib/domain/recurring";
import { horseSharedCosts } from "@/lib/domain/calculations";
import type { RecurringExpense, StableData } from "@/lib/domain/types";

function rec(partial: Partial<RecurringExpense>): RecurringExpense {
  return {
    id: "r",
    stableId: "s",
    label: "Crédit",
    amount: 300,
    isShared: true,
    distributionMode: "equal",
    frequency: "monthly",
    startDate: "2024-01-01",
    endDate: null,
    source: "manual",
    ...partial,
  };
}

describe("recurringDue", () => {
  it("monthly is due every month within range", () => {
    expect(recurringDue(rec({}), { year: 2024, month: 5 })).toBe(true);
  });
  it("is not due before the start", () => {
    expect(recurringDue(rec({ startDate: "2024-06-01" }), { year: 2024, month: 5 })).toBe(false);
  });
  it("is not due after the end (a finished loan)", () => {
    expect(recurringDue(rec({ endDate: "2024-03-31" }), { year: 2024, month: 5 })).toBe(false);
  });
  it("quarterly is due every 3 months from start", () => {
    const r = rec({ frequency: "quarterly", startDate: "2024-01-01" });
    expect(recurringDue(r, { year: 2024, month: 1 })).toBe(true);
    expect(recurringDue(r, { year: 2024, month: 2 })).toBe(false);
    expect(recurringDue(r, { year: 2024, month: 4 })).toBe(true);
  });
  it("yearly is due on the anniversary month", () => {
    const r = rec({ frequency: "yearly", startDate: "2024-03-01" });
    expect(recurringDue(r, { year: 2025, month: 3 })).toBe(true);
    expect(recurringDue(r, { year: 2025, month: 4 })).toBe(false);
  });
});

describe("recurring folds into shared costs", () => {
  it("a monthly stable loan is split across horses", () => {
    const data: StableData = {
      horses: [
        { id: "h1", stableId: "s", name: "A", entryDate: "2020-01-01", exitDate: null, isArchived: false },
        { id: "h2", stableId: "s", name: "B", entryDate: "2020-01-01", exitDate: null, isArchived: false },
      ],
      revenues: [],
      directExpenses: [],
      sharedExpenses: [],
      revenueCategories: [],
      expenseCategories: [],
      recurringExpenses: [rec({ amount: 300, frequency: "monthly", startDate: "2024-01-01" })],
    };
    // 300 split equally over 2 horses = 150 each.
    expect(horseSharedCosts(data, "h1", { year: 2024, month: 2 })).toBe(150);
  });
});

import { horseRevenue } from "@/lib/domain/calculations";

describe("recurring revenue folds into horse revenue", () => {
  it("a monthly pension is counted every month", () => {
    const data: StableData = {
      horses: [{ id: "h1", stableId: "s", name: "A", entryDate: "2020-01-01", exitDate: null, isArchived: false }],
      revenues: [],
      directExpenses: [],
      sharedExpenses: [],
      revenueCategories: [],
      expenseCategories: [],
      recurringRevenues: [
        {
          id: "rr1",
          stableId: "s",
          horseId: "h1",
          amount: 450,
          frequency: "monthly",
          startDate: "2024-01-01",
          endDate: null,
          source: "recurring",
        },
      ],
    };
    expect(horseRevenue(data, "h1", { year: 2024, month: 6 })).toBe(450);
    // before it starts → 0
    expect(horseRevenue({ ...data, recurringRevenues: [{ ...data.recurringRevenues![0], startDate: "2024-07-01" }] }, "h1", { year: 2024, month: 6 })).toBe(0);
  });
});
