import { describe, expect, it } from "vitest";
import { buildDemoData } from "@/lib/data/demo-data";
import { generateInsights } from "@/lib/domain/insights-engine";
import { monthBreakdown } from "@/lib/domain/ticket";
import { formatEur } from "@/lib/utils/format-currency";

const NOW = new Date("2026-10-16T12:00:00");
const oct = { year: 2026, month: 10 };

describe("Découvertes : des constats justes (P2-9)", () => {
  it("pas de comparaison à un « an dernier » sans données", () => {
    const d = buildDemoData(NOW);
    expect(generateInsights(d, oct).some((i) => i.type === "vs_last_year")).toBe(false);
  });
  it("les frais communs ont le même total que Mon mois (assurance comprise)", () => {
    const d = buildDemoData(NOW);
    const shared = generateInsights(d, oct).find((i) => i.type === "shared_expense_impact")!;
    const total = monthBreakdown(d, oct).sharedTotal;
    expect(shared.body).toContain(`font ${formatEur(total)} ce mois-ci`);
    // L'assurance (120 €) n'est plus oubliée.
    const sansAssurance = d.sharedExpenses.filter((s) => s.periodMonth === 10 && s.periodYear === 2026).reduce((t, s) => t + s.totalAmount, 0);
    expect(total).toBe(sansAssurance + 120);
  });
  it("avec des données l'an dernier, la comparaison revient", () => {
    const d = buildDemoData(NOW);
    d.revenues.push({ id: "old", stableId: "s", horseId: d.horses[0].id, amount: 100, date: "2025-10-05", source: "manual" });
    expect(generateInsights(d, oct).some((i) => i.type === "vs_last_year")).toBe(true);
  });
});
