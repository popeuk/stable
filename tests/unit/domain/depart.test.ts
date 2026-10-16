import { describe, expect, it } from "vitest";
import { buildDemoData } from "@/lib/data/demo-data";
import { aggregateStablePnl, horsePnl, stablePnl } from "@/lib/domain/calculations";
import { monthBreakdown } from "@/lib/domain/ticket";
import { billsFor } from "@/lib/domain/billing";
import { ensurePensions } from "@/lib/domain/autopilot";
import { arreterRecurrentes, daterLesDeparts, presentDans, repartition, revenirALEcurie } from "@/lib/domain/presence";
import { addMonths, lastNPeriods } from "@/lib/utils/period";
import type { StableData } from "@/lib/domain/types";

const NOW = new Date("2026-10-16T12:00:00");
const oct = { year: 2026, month: 10 };
const nov = { year: 2026, month: 11 };
const six = lastNPeriods(oct, 6);
const demo = () => buildDemoData(NOW);
const pacha = (d: StableData) => d.horses.find((h) => h.name === "Pacha")!;
const partir = (d: StableData, id: string, date: string): StableData => ({
  ...d,
  horses: d.horses.map((h) => (h.id === id ? { ...h, isArchived: true, exitDate: date } : h)),
});

describe("un cheval qui part garde son argent du passé (P1-4)", () => {
  it("le bilan des six derniers mois ne bouge pas quand Pacha part", () => {
    const d = demo();
    const avant = aggregateStablePnl(d, six);
    const apres = aggregateStablePnl(partir(d, pacha(d).id, "2026-10-16"), six);
    expect(apres.revenue).toBe(avant.revenue);
    expect(apres.charges).toBe(avant.charges);
    expect(apres.netResult).toBe(avant.netResult);
    expect(monthBreakdown(partir(d, pacha(d).id, "2026-10-16"), oct).net).toBe(monthBreakdown(d, oct).net);
  });

  it("le mois suivant, il ne compte plus : ni pension, ni part, ni facture au propriétaire", () => {
    const d = partir(demo(), pacha(demo()).id, "2026-10-16");
    const id = pacha(d).id;
    expect(stablePnl(d, nov).perHorse.some((p) => p.horseId === id)).toBe(false);
    expect(ensurePensions(d, "2026-11-01").some((r) => r.horseId === id)).toBe(false);
    const withNov = { ...d, revenues: [...d.revenues, ...ensurePensions(d, "2026-11-01")] };
    expect(billsFor(withNov, nov).some((b) => b.payer === "Julie P.")).toBe(false);
    // Il ne prend plus de part de l'assurance : les autres la partagent.
    expect(horsePnl(withNov, id, nov).sharedCosts).toBe(0);
    expect(stablePnl(withNov, nov).sharedCosts).toBe(120);
  });

  it("un cheval parti revient : même mois, tout redevient comme avant ; plus tard, il arrive à nouveau", () => {
    const h = { id: "h", stableId: "s", name: "P", entryDate: "2024-01-01", exitDate: "2026-10-16", isArchived: true };
    expect(revenirALEcurie(h, "2026-10-20")).toMatchObject({ isArchived: false, exitDate: null, entryDate: "2024-01-01" });
    const plusTard = revenirALEcurie(h, "2027-01-10");
    expect(plusTard).toMatchObject({ isArchived: false, exitDate: null, entryDate: "2027-01-10" });
    expect(presentDans(plusTard, { year: 2026, month: 12 })).toBe(false);
    expect(presentDans(plusTard, { year: 2027, month: 1 })).toBe(true);
  });
});

describe("migration douce des chevaux déjà archivés sans date", () => {
  it("ils reçoivent la date de leur dernière ligne d'argent : le passé revient", () => {
    const d = demo();
    const avant = aggregateStablePnl(d, six);
    const ancien = { ...d, horses: d.horses.map((h) => (h.name === "Pacha" ? { ...h, isArchived: true, exitDate: null } : h)) };
    const migre = daterLesDeparts(ancien);
    const p = pacha(migre);
    expect(p.exitDate).toMatch(/^2026-10-/);
    expect(aggregateStablePnl(migre, six).netResult).toBe(avant.netResult);
    // Rien ne change pour les chevaux toujours là.
    expect(migre.horses.filter((h) => !h.isArchived)).toEqual(d.horses.filter((h) => h.name !== "Pacha"));
  });
  it("sans aucune ligne, la date d'arrivée", () => {
    const d: StableData = { ...demo(), horses: [{ id: "x", stableId: "s", name: "X", entryDate: "2025-03-01", exitDate: null, isArchived: true }] };
    expect(daterLesDeparts(d).horses[0].exitDate).toBe("2025-03-01");
  });
});

describe("« Arrêter » une charge récurrente date sa fin (P1-6)", () => {
  it("le passé reste, le mois suivant ne la compte plus", () => {
    const d = demo();
    const avant = aggregateStablePnl(d, six);
    const stop = { ...d, recurringExpenses: arreterRecurrentes(d.recurringExpenses!, "rec-credit", "2026-10-16") };
    expect(stop.recurringExpenses![0].endDate).toBe("2026-10-16");
    expect(aggregateStablePnl(stop, six).charges).toBe(avant.charges);
    expect(stablePnl(stop, nov).sharedCosts).toBe(stablePnl(d, nov).sharedCosts - 120);
  });
  it("une récurrente qui n'a pas encore commencé ne compte nulle part", () => {
    const r = [{ id: "r", startDate: "2026-12-01", endDate: null }];
    expect(arreterRecurrentes(r, "r", "2026-10-16")[0].endDate).toBe("2026-11-30");
  });
});

describe("frais communs notés sans cheval (P1-5)", () => {
  const vide = (): StableData => ({ ...demo(), horses: [], revenues: [], directExpenses: [], sharedExpenses: [], recurringExpenses: [], recurringRevenues: [] });
  const foin = { id: "se", stableId: "s", label: "Foin", totalAmount: 500, periodMonth: 10, periodYear: 2026, distributionMode: "equal" as const, source: "manual" as const, allocations: [] };

  it("ils comptent dans le mois, même sans aucun cheval", () => {
    const d = { ...vide(), sharedExpenses: [foin] };
    const s = stablePnl(d, oct);
    expect(s.sharedCosts).toBe(500);
    expect(s.netResult).toBe(-500);
    const m = monthBreakdown(d, oct);
    expect(m.net).toBe(-500);
    expect(m.sharedTotal).toBe(500);
    expect(m.shared).toEqual([{ label: "Foin", amount: 500 }]);
  });

  it("dès qu'un cheval arrive dans le mois, il porte la facture ; un cheval arrivé le mois d'après, non", () => {
    const h1 = { id: "h1", stableId: "s", name: "A", entryDate: "2026-10-20", exitDate: null, isArchived: false };
    const h2 = { id: "h2", stableId: "s", name: "B", entryDate: "2026-11-02", exitDate: null, isArchived: false };
    const d = { ...vide(), horses: [h1, h2], sharedExpenses: [foin] };
    expect(repartition(d, foin)).toEqual([{ horseId: "h1", allocatedAmount: 500, presenceDays: undefined }]);
    expect(stablePnl(d, oct).sharedCosts).toBe(500);
    expect(stablePnl(d, oct).netResult).toBe(-500);
    expect(horsePnl(d, "h2", oct).sharedCosts).toBe(0);
  });

  it("la part se recalcule quand un cheval arrive dans le mois (P2-6)", () => {
    const h = (id: string) => ({ id, stableId: "s", name: id, entryDate: "2026-01-01", exitDate: null, isArchived: false });
    const d = { ...vide(), horses: [h("a"), h("b"), h("c")], sharedExpenses: [{ ...foin, totalAmount: 1200 }] };
    expect(horsePnl(d, "a", oct).sharedCosts).toBe(400);
    const plus = { ...d, horses: [...d.horses, { ...h("d"), entryDate: "2026-10-16" }] };
    expect(horsePnl(plus, "a", oct).sharedCosts).toBe(300);
    expect(stablePnl(plus, oct).sharedCosts).toBe(1200);
  });

  it("une charge récurrente partagée sans aucun cheval compte aussi", () => {
    const d = { ...vide(), recurringExpenses: demo().recurringExpenses };
    expect(stablePnl(d, oct).sharedCosts).toBe(120);
    expect(monthBreakdown(d, oct).net).toBe(-120);
  });

  it("une répartition notée à la main reste telle quelle", () => {
    const d = demo();
    const se = d.sharedExpenses.find((x) => x.periodMonth === 10 && x.periodYear === 2026)!;
    expect(repartition(d, se)).toBe(se.allocations);
    expect(addMonths(oct, 1)).toEqual(nov);
  });
});
