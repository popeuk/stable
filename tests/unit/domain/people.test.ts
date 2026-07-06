import { describe, it, expect } from "vitest";
import { derivePeople } from "@/lib/domain/people";
import type { StableData } from "@/lib/domain/types";

const base: StableData = {
  horses: [
    { id: "h1", stableId: "s", name: "Belle", ownerName: "Claire Dumas", entryDate: "2020-01-01", exitDate: null, isArchived: false },
    { id: "h2", stableId: "s", name: "Sirius", ownerName: "claire dumas", entryDate: "2020-01-01", exitDate: null, isArchived: false },
    { id: "h3", stableId: "s", name: "Diva", ownerName: "Paul Weiss", entryDate: "2020-01-01", exitDate: null, isArchived: true },
  ],
  revenues: [],
  directExpenses: [],
  sharedExpenses: [],
  revenueCategories: [],
  expenseCategories: [],
  careEvents: [
    { id: "c1", stableId: "s", horseId: "h1", kind: "ferrure", date: "2026-06-01", provider: "M. Roche", cost: 90 },
    { id: "c2", stableId: "s", horseId: "h2", kind: "ferrure", date: "2026-06-20", provider: "M. Roche", cost: 90 },
    { id: "c3", stableId: "s", horseId: "h1", kind: "veto", date: "2026-05-10", provider: "Dr Lavigne" },
  ],
};

describe("derivePeople", () => {
  it("merges case-insensitively and links horses", () => {
    const people = derivePeople(base);
    const claire = people.find((p) => p.name.toLowerCase() === "claire dumas")!;
    expect(claire.roles).toEqual(["proprietaire"]);
    expect(claire.horseIds.sort()).toEqual(["h1", "h2"]);
  });

  it("derives providers with act counts, billing and last seen", () => {
    const people = derivePeople(base);
    const roche = people.find((p) => p.name === "M. Roche")!;
    expect(roche.roles).toEqual(["prestataire"]);
    expect(roche.actCount).toBe(2);
    expect(roche.totalBilled).toBe(180);
    expect(roche.lastSeen).toBe("2026-06-20");
  });

  it("ignores archived horses' owners", () => {
    const people = derivePeople(base);
    expect(people.find((p) => p.name === "Paul Weiss")).toBeUndefined();
  });
});
