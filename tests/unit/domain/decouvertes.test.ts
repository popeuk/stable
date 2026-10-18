import { describe, expect, it } from "vitest";
import { buildDemoData } from "@/lib/data/demo-data";
import { monthBreakdown } from "@/lib/domain/ticket";

const NOW = new Date("2026-10-16T12:00:00");
const oct = { year: 2026, month: 10 };

describe("Les frais de l'écurie du mois (P2-9)", () => {
  it("comptent l'assurance avec le reste, comme Mon bilan", () => {
    const d = buildDemoData(NOW);
    const total = monthBreakdown(d, oct).sharedTotal;
    // L'assurance (120 €) n'est plus oubliée.
    const sansAssurance = d.sharedExpenses.filter((s) => s.periodMonth === 10 && s.periodYear === 2026).reduce((t, s) => t + s.totalAmount, 0);
    expect(total).toBe(sansAssurance + 120);
  });
});
