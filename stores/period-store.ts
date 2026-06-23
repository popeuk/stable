"use client";

import { create } from "zustand";
import type { Period } from "@/lib/domain/types";
import {
  addMonths,
  currentPeriod,
  samePeriod,
  rangePeriods,
  type RangePreset,
} from "@/lib/utils/period";

interface PeriodState {
  /** The focused month (used by the ribbon and single-month views). */
  active: Period;
  /** The active range preset for the dashboard. */
  preset: RangePreset;
  setActive: (p: Period) => void;
  setPreset: (preset: RangePreset) => void;
  step: (delta: number) => void;
  reset: () => void;
  isCurrent: () => boolean;
  /** The months covered by the active preset (oldest first). */
  periods: () => Period[];
}

/**
 * The active period & range drive the whole app (the Time Ribbon + the period
 * selector). Selecting a single month switches the preset back to "month".
 */
export const usePeriodStore = create<PeriodState>((set, get) => ({
  active: currentPeriod(),
  preset: "month",
  setActive: (p) => set({ active: p, preset: "month" }),
  setPreset: (preset) => set({ preset }),
  step: (delta) => set((s) => ({ active: addMonths(s.active, delta), preset: "month" })),
  reset: () => set({ active: currentPeriod(), preset: "month" }),
  isCurrent: () => samePeriod(get().active, currentPeriod()),
  periods: () => rangePeriods(get().active, get().preset),
}));
