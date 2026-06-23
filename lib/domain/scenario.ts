/**
 * Scenario simulator (section 11.3). Pure, runs client-side in real time
 * as the user drags sliders — no server round trip.
 */

export interface ScenarioHorse {
  id: string;
  name: string;
  pension: number;
  variableCost: number;
}

export interface ScenarioParams {
  /** Global percentage adjustment applied to every pension, -20..+30. */
  pensionAdjustment: number;
  /** When set, overrides every horse's variable cost. */
  globalVariableCost?: number;
  useGlobalVariableCost: boolean;
  fixedCosts: number;
}

export interface ScenarioResults {
  monthlyResult: number;
  breakEvenPerSlot: number;
  totalRevenue: number;
  totalVariableCost: number;
  horsesUnderThreshold: number;
  horsesUnderThresholdList: string[];
}

export function simulateScenario(
  params: ScenarioParams,
  horses: ScenarioHorse[],
): ScenarioResults {
  const adjusted = horses.map((h) => ({
    ...h,
    pension: h.pension * (1 + params.pensionAdjustment / 100),
    variableCost:
      params.useGlobalVariableCost && params.globalVariableCost != null
        ? params.globalVariableCost
        : h.variableCost,
  }));

  const totalRevenue = adjusted.reduce((s, h) => s + h.pension, 0);
  const totalVariableCost = adjusted.reduce((s, h) => s + h.variableCost, 0);
  const fixedCosts = params.fixedCosts;
  const monthlyResult = totalRevenue - totalVariableCost - fixedCosts;
  const breakEvenPerSlot =
    adjusted.length > 0 ? fixedCosts / adjusted.length : 0;

  const under = adjusted.filter(
    (h) => h.pension - h.variableCost < breakEvenPerSlot,
  );

  return {
    monthlyResult: round2(monthlyResult),
    breakEvenPerSlot: round2(breakEvenPerSlot),
    totalRevenue: round2(totalRevenue),
    totalVariableCost: round2(totalVariableCost),
    horsesUnderThreshold: under.length,
    horsesUnderThresholdList: under.map((h) => h.id),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
