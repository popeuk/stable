import { describe, expect, it } from "vitest";
import { buildDemoData } from "@/lib/data/demo-data";
import { tvaDuMois, tvaDans } from "@/lib/domain/tva";
import type { StableData } from "@/lib/domain/types";

const NOW = new Date("2026-11-27T15:00:00");
const P = { year: 2026, month: 11 };

const avecTaux = (d: StableData, recette: Record<string, number>, frais: number | null): StableData => ({
  ...d,
  revenueCategories: d.revenueCategories.map((c) => (c.name in recette ? { ...c, vatRate: recette[c.name] } : c)),
  expenseCategories: d.expenseCategories.map((c) => ({ ...c, vatRate: frais })),
});

describe("le taux de TVA d'une catégorie", () => {
  const d = buildDemoData(NOW);

  it("sans aucun taux, rien n'est deviné : tout est compté à part", () => {
    const t = tvaDuMois(d, P);
    expect(t.tvaCollectee).toBe(0);
    expect(t.recettesSansTaux).toBe(t.caTTC);
  });

  it("le taux de la catégorie sert quand la recette n'en a pas", () => {
    const t = tvaDuMois(avecTaux(d, { Pension: 20, Cours: 5.5 }, null), P);
    expect(t.recettesSansTaux).toBe(0);
    const pension = d.revenues.filter((r) => r.date.startsWith("2026-11") && d.revenueCategories.find((c) => c.id === r.categoryId)?.name === "Pension").reduce((s, r) => s + r.amount, 0);
    expect(t.tvaCollectee).toBeGreaterThanOrEqual(tvaDans(pension, 20) - 0.5);
  });

  it("le taux d'une recette, d'une prestation ou d'une pension passe avant celui de la catégorie", () => {
    const r = d.revenues.find((x) => x.date.startsWith("2026-11"))!;
    const seule = { ...d, revenues: [{ ...r, vatRate: 0 }], recurringRevenues: [] };
    const t = tvaDuMois(avecTaux(seule, { Pension: 20, Cours: 20 }, null), P);
    expect(t.tvaCollectee).toBe(0);
    expect(t.recettesSansTaux).toBe(0);
  });

  it("les frais prennent aussi le taux de leur catégorie, et la TVA à reverser se calcule", () => {
    const t = tvaDuMois(avecTaux(d, { Pension: 20, Cours: 20 }, 20), P);
    expect(t.tvaDeductible).toBeGreaterThan(0);
    expect(t.aReverser).toBeCloseTo(t.tvaCollectee - t.tvaDeductible, 2);
  });
});
