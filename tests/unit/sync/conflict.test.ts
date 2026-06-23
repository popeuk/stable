import { describe, it, expect } from "vitest";
import { resolveLWW, mergeSharedExpense } from "@/lib/data/sync/conflict";
import type { Horse, SharedExpense } from "@/lib/domain/types";

describe("resolveLWW", () => {
  it("picks the newer write", () => {
    expect(resolveLWW(2000, 1000)).toBe("local");
    expect(resolveLWW(1000, 2000)).toBe("remote");
  });
  it("resolves ties to the server", () => {
    expect(resolveLWW(1000, 1000)).toBe("remote");
  });
  it("parses ISO timestamps", () => {
    expect(resolveLWW("2024-02-02T00:00:00Z", "2024-02-01T00:00:00Z")).toBe("local");
  });
});

describe("mergeSharedExpense", () => {
  const horses: Horse[] = [
    { id: "h1", stableId: "s", name: "A", entryDate: "2020-01-01", exitDate: null, isArchived: false },
    { id: "h2", stableId: "s", name: "B", entryDate: "2020-01-01", exitDate: null, isArchived: false },
    { id: "h3", stableId: "s", name: "C", entryDate: "2020-01-01", exitDate: null, isArchived: false },
  ];

  const base = {
    id: "se1",
    stableId: "s",
    label: "Foin",
    periodMonth: 2,
    periodYear: 2024,
    distributionMode: "equal" as const,
    source: "manual" as const,
  };

  it("unions the horse sets and re-splits the total", () => {
    // local added h3; remote still had {h1,h2}. Newer total wins, split over 3.
    const local: SharedExpense = {
      ...base,
      totalAmount: 300,
      allocations: [
        { horseId: "h1", allocatedAmount: 100 },
        { horseId: "h2", allocatedAmount: 100 },
        { horseId: "h3", allocatedAmount: 100 },
      ],
    };
    const remote: SharedExpense = {
      ...base,
      totalAmount: 200,
      allocations: [
        { horseId: "h1", allocatedAmount: 100 },
        { horseId: "h2", allocatedAmount: 100 },
      ],
    };
    const merged = mergeSharedExpense(local, remote, {
      localUpdatedAt: 2000,
      remoteUpdatedAt: 1000,
      horses,
    });
    // local is newer → total 300, union {h1,h2,h3}
    expect(merged.totalAmount).toBe(300);
    expect(merged.allocations.map((a) => a.horseId).sort()).toEqual(["h1", "h2", "h3"]);
    const sum = merged.allocations.reduce((s, a) => s + a.allocatedAmount, 0);
    expect(Math.round(sum * 100) / 100).toBe(300);
  });

  it("takes the remote total on a tie but still unions horses", () => {
    const local: SharedExpense = {
      ...base,
      totalAmount: 300,
      allocations: [{ horseId: "h3", allocatedAmount: 300 }],
    };
    const remote: SharedExpense = {
      ...base,
      totalAmount: 200,
      allocations: [
        { horseId: "h1", allocatedAmount: 100 },
        { horseId: "h2", allocatedAmount: 100 },
      ],
    };
    const merged = mergeSharedExpense(local, remote, {
      localUpdatedAt: 1000,
      remoteUpdatedAt: 1000,
      horses,
    });
    expect(merged.totalAmount).toBe(200); // tie → remote
    expect(merged.allocations.map((a) => a.horseId).sort()).toEqual(["h1", "h2", "h3"]);
  });
});
