import { describe, expect, it } from "vitest";
import { clientRevenues } from "@/lib/domain/clients";
import type { StableData } from "@/lib/domain/types";

const data = {
  horses: [
    { id: "h1", stableId: "s", name: "Tango", ownerName: "Julie", entryDate: "2026-01-01", isArchived: false },
    { id: "h2", stableId: "s", name: "Rio", ownerName: "Marc", entryDate: "2026-01-01", isArchived: false },
  ],
  revenueCategories: [{ id: "pen", name: "Pension" }],
  people: [{ id: "p1", name: "Emma", role: "cavalier", active: true }],
  revenues: [
    { id: "r1", stableId: "s", horseId: "h1", categoryId: "pen", amount: 420, date: "2026-10-01", source: "manual" },
    { id: "r2", stableId: "s", horseId: "h1", amount: 60, date: "2026-10-05", source: "manual", rebillOf: "e1" },
    { id: "r3", stableId: "s", horseId: "h1", amount: 25, date: "2026-10-06", source: "manual", payer: "Emma", seanceId: "s1" },
    { id: "r4", stableId: "s", horseId: "h2", categoryId: "pen", amount: 380, date: "2026-10-01", source: "manual" },
    { id: "r5", stableId: "s", horseId: "h2", categoryId: "pen", amount: 380, date: "2026-09-01", source: "manual" },
  ],
} as unknown as StableData;

describe("chiffre d'affaires par client", () => {
  const out = clientRevenues(data, { year: 2026, month: 10 });
  it("range ce que chacun paie, le plus gros d'abord", () => {
    expect(out.map((c) => [c.name, c.total])).toEqual([["Julie", 480], ["Marc", 380], ["Emma", 25]]);
  });
  it("sépare la pension, les soins refacturés et les séances", () => {
    expect(out[0].buckets).toEqual({ pension: 420, seances: 0, soins: 60, autres: 0 });
    expect(out[2]).toMatchObject({ role: "cavalier", buckets: { seances: 25 } });
  });
  it("garde les chevaux du propriétaire et ignore les autres mois", () => {
    expect(out[1]).toMatchObject({ role: "proprietaire", horses: ["Rio"], total: 380 });
  });
});
