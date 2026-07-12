import { describe, it, expect } from "vitest";
import { ensurePensions, pensionRevenueId } from "@/lib/domain/autopilot";
import type { Horse, Revenue, Category } from "@/lib/domain/types";

const CATS: Category[] = [
  { id: "cat-pension", name: "Pension" },
  { id: "cat-cours", name: "Cours" },
];

function horse(partial: Partial<Horse>): Horse {
  return {
    id: "h1",
    stableId: "s",
    name: "Belle",
    entryDate: "2025-01-01",
    exitDate: null,
    isArchived: false,
    pension: 450,
    ...partial,
  };
}

function rev(partial: Partial<Revenue>): Revenue {
  return {
    id: "r1",
    stableId: "s",
    horseId: "h1",
    categoryId: "cat-pension",
    amount: 450,
    date: "2026-07-01",
    source: "manual",
    ...partial,
  };
}

describe("ensurePensions", () => {
  it("poste la pension du mois pour un cheval actif sous contrat", () => {
    const out = ensurePensions(
      { horses: [horse({})], revenues: [], revenueCategories: CATS },
      "2026-07-12",
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: pensionRevenueId("h1", "2026-07"),
      horseId: "h1",
      categoryId: "cat-pension",
      amount: 450,
      date: "2026-07-01",
      source: "recurring",
    });
  });

  it("est idempotent : une pension déjà présente ce mois-ci (peu importe la source) bloque", () => {
    const out = ensurePensions(
      {
        horses: [horse({})],
        revenues: [rev({ id: "manuel-quelconque", date: "2026-07-03" })],
        revenueCategories: CATS,
      },
      "2026-07-12",
    );
    expect(out).toHaveLength(0);
  });

  it("un revenu d'une AUTRE catégorie ou d'un autre mois ne bloque pas", () => {
    const out = ensurePensions(
      {
        horses: [horse({})],
        revenues: [
          rev({ id: "cours", categoryId: "cat-cours", date: "2026-07-03" }),
          rev({ id: "vieux", date: "2026-06-01" }),
        ],
        revenueCategories: CATS,
      },
      "2026-07-12",
    );
    expect(out).toHaveLength(1);
  });

  it("ignore les chevaux archivés, sans contrat, sortis ou pas encore entrés", () => {
    const out = ensurePensions(
      {
        horses: [
          horse({ id: "arch", isArchived: true }),
          horse({ id: "sans", pension: undefined }),
          horse({ id: "sorti", exitDate: "2026-05-31" }),
          horse({ id: "futur", entryDate: "2026-08-01" }),
        ],
        revenues: [],
        revenueCategories: CATS,
      },
      "2026-07-12",
    );
    expect(out).toHaveLength(0);
  });

  it("un cheval entré en cours de mois est facturé depuis son entrée", () => {
    const out = ensurePensions(
      { horses: [horse({ entryDate: "2026-07-10" })], revenues: [], revenueCategories: CATS },
      "2026-07-12",
    );
    expect(out[0].date).toBe("2026-07-10");
  });

  it("une pension auto-postée supprimée par le gérant ne revient jamais", () => {
    const out = ensurePensions(
      { horses: [horse({})], revenues: [], revenueCategories: CATS },
      "2026-07-12",
      [pensionRevenueId("h1", "2026-07")],
    );
    expect(out).toHaveLength(0);
  });

  it("sans catégorie Pension, ne poste rien (jamais de crash)", () => {
    const out = ensurePensions(
      { horses: [horse({})], revenues: [], revenueCategories: [] },
      "2026-07-12",
    );
    expect(out).toHaveLength(0);
  });
});
