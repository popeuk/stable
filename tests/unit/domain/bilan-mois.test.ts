import { describe, expect, it } from "vitest";
import { buildDemoData } from "@/lib/data/demo-data";
import { bilanDuMois } from "@/lib/domain/bilan-mois";
import { monthBreakdown } from "@/lib/domain/ticket";

const NOW = new Date("2026-11-27T15:00:00");
const P = { year: 2026, month: 11 };

describe("le bilan du mois (Suivi, repris du Clos)", () => {
  const data = buildDemoData(NOW);
  const b = bilanDuMois(data, P, 120);

  it("reprend les chiffres du reste de l'app : rentre, sort, reste", () => {
    const m = monthBreakdown(data, P);
    expect(b.rentre).toBeCloseTo(m.revenue, 2);
    expect(b.reste).toBeCloseTo(m.net, 2);
    expect(b.rentre - b.sort).toBeCloseTo(b.reste, 2);
  });

  it("dit combien restent sur 10 € encaissés, entre 0 et 10", () => {
    expect(b.surDix).toBeGreaterThanOrEqual(0);
    expect(b.surDix).toBeLessThanOrEqual(10);
    expect(b.surDix).toBe(Math.round((b.reste / b.rentre) * 10));
  });

  it("ajoute ce qui est encore prévu pour la fin du mois", () => {
    expect(b.finDeMois).toBeCloseTo(b.reste + 120, 2);
  });

  it("range les sources, les clients et les chevaux du plus gros au plus petit", () => {
    const desc = (l: number[]) => l.every((x, i) => i === 0 || l[i - 1] >= x);
    expect(desc(b.sources.map((s) => s.montant))).toBe(true);
    expect(desc(b.clients.map((c) => c.rapporte))).toBe(true);
    expect(desc(b.chevaux.map((c) => c.reste))).toBe(true);
    expect(b.sources.reduce((s, x) => s + x.montant, 0)).toBeCloseTo(b.rentre, 0);
  });

  it("ce que coûte un cheval, c'est ce qu'il rapporte moins ce qu'il laisse", () => {
    for (const c of b.chevaux) expect(c.rapporte - c.coute).toBeCloseTo(c.reste, 2);
  });

  it("un mois vide ne divise pas par zéro", () => {
    const vide = bilanDuMois({ ...data, revenues: [], seances: [], horses: [], recurringRevenues: [], pensions: [] }, { year: 2020, month: 1 });
    expect(vide.surDix).toBe(0);
    expect(vide.clients).toEqual([]);
    expect(vide.partTop3).toBe(0);
  });
});
