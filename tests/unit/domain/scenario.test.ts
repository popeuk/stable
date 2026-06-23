import { describe, it, expect } from "vitest";
import { simulateScenario, type ScenarioHorse } from "@/lib/domain/scenario";

const horses: ScenarioHorse[] = [
  { id: "a", name: "A", pension: 600, variableCost: 240 },
  { id: "b", name: "B", pension: 400, variableCost: 300 },
];

describe("simulateScenario", () => {
  it("computes the base monthly result", () => {
    const r = simulateScenario(
      { pensionAdjustment: 0, fixedCosts: 200, useGlobalVariableCost: false },
      horses,
    );
    // revenue 1000 - variable 540 - fixed 200 = 260
    expect(r.totalRevenue).toBe(1000);
    expect(r.totalVariableCost).toBe(540);
    expect(r.monthlyResult).toBe(260);
    expect(r.breakEvenPerSlot).toBe(100);
  });

  it("applies a global pension adjustment", () => {
    const r = simulateScenario(
      { pensionAdjustment: 10, fixedCosts: 0, useGlobalVariableCost: false },
      horses,
    );
    expect(r.totalRevenue).toBeCloseTo(1100, 5);
  });

  it("flags horses under the per-slot break-even", () => {
    const r = simulateScenario(
      { pensionAdjustment: 0, fixedCosts: 400, useGlobalVariableCost: false },
      horses,
    );
    // break-even per slot = 200. A margin = 360 (ok), B margin = 100 (under)
    expect(r.horsesUnderThreshold).toBe(1);
    expect(r.horsesUnderThresholdList).toEqual(["b"]);
  });

  it("overrides variable cost when requested", () => {
    const r = simulateScenario(
      { pensionAdjustment: 0, fixedCosts: 0, useGlobalVariableCost: true, globalVariableCost: 100 },
      horses,
    );
    expect(r.totalVariableCost).toBe(200);
  });
});
