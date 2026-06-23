import { describe, it, expect } from "vitest";
import { distribute, presenceDays } from "@/lib/domain/distribution";
import type { Horse } from "@/lib/domain/types";

function horse(id: string, entry: string, exit: string | null = null): Horse {
  return {
    id,
    stableId: "s",
    name: id,
    entryDate: entry,
    exitDate: exit,
    isArchived: false,
  };
}

describe("presenceDays", () => {
  const feb = { year: 2024, month: 2 }; // 29 days

  it("counts the full month when present throughout", () => {
    expect(presenceDays(horse("a", "2020-01-01"), feb)).toBe(29);
  });

  it("counts from the entry date when entering mid-month (inclusive)", () => {
    // present 15..29 → 15 days
    expect(presenceDays(horse("a", "2024-02-15"), feb)).toBe(15);
  });

  it("counts up to the exit date when leaving mid-month (inclusive)", () => {
    // present 1..10 → 10 days
    expect(presenceDays(horse("a", "2020-01-01", "2024-02-10"), feb)).toBe(10);
  });

  it("returns 0 when absent for the whole month", () => {
    expect(presenceDays(horse("a", "2024-03-01"), feb)).toBe(0);
    expect(presenceDays(horse("a", "2020-01-01", "2024-01-31"), feb)).toBe(0);
  });
});

describe("distribute", () => {
  const period = { year: 2024, month: 2 };

  it("splits equally and sums back to the total", () => {
    const horses = [horse("a", "2020-01-01"), horse("b", "2020-01-01"), horse("c", "2020-01-01")];
    const allocs = distribute(100, horses, "equal", period);
    const sum = allocs.reduce((s, a) => s + a.allocatedAmount, 0);
    expect(Math.round(sum * 100) / 100).toBe(100);
    // 100/3 = 33.33, remainder pushed to one share
    expect(allocs.map((a) => a.allocatedAmount).sort()).toEqual([33.33, 33.33, 33.34]);
  });

  it("weights by presence days", () => {
    const horses = [
      horse("full", "2020-01-01"), // 29 days
      horse("half", "2024-02-15"), // 15 days
    ];
    const allocs = distribute(440, horses, "weighted_by_days", period);
    const byId = Object.fromEntries(allocs.map((a) => [a.horseId, a.allocatedAmount]));
    const total = 29 + 15;
    expect(byId.full).toBeCloseTo((29 / total) * 440, 1);
    expect(byId.half).toBeCloseTo((15 / total) * 440, 1);
    expect(byId.full + byId.half).toBeCloseTo(440, 2);
  });

  it("falls back to an equal split when nobody is present", () => {
    const horses = [horse("a", "2030-01-01"), horse("b", "2030-01-01")];
    const allocs = distribute(50, horses, "weighted_by_days", period);
    expect(allocs.map((a) => a.allocatedAmount)).toEqual([25, 25]);
  });

  it("returns nothing for an empty horse list", () => {
    expect(distribute(100, [], "equal", period)).toEqual([]);
  });
});
