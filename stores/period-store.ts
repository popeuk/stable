"use client";

import { create } from "zustand";
import type { Period } from "@/lib/domain/types";
import { addMonths, currentPeriod, samePeriod } from "@/lib/utils/period";

interface PeriodState {
  active: Period;
  setActive: (p: Period) => void;
  step: (delta: number) => void;
  reset: () => void;
  isCurrent: () => boolean;
}

/**
 * The active period drives the whole app (the Time Ribbon, section 6.1).
 * Changing it here re-renders every screen scoped to that month.
 */
export const usePeriodStore = create<PeriodState>((set, get) => ({
  active: currentPeriod(),
  setActive: (p) => set({ active: p }),
  step: (delta) => set((s) => ({ active: addMonths(s.active, delta) })),
  reset: () => set({ active: currentPeriod() }),
  isCurrent: () => samePeriod(get().active, currentPeriod()),
}));
