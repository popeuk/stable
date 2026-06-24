"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface NotificationPrefs {
  weeklyInsight: boolean;
  monthlyAudit: boolean;
  horseAlerts: boolean;
}

interface SettingsState {
  notifications: NotificationPrefs;
  /** Number of stalls the stable can host — drives occupancy advice. */
  capacity: number;
  /** Has the user seen the intro onboarding? */
  onboarded: boolean;
  toggle: (key: keyof NotificationPrefs) => void;
  setCapacity: (n: number) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

/** Granular, opt-in notification preferences (spec 1.3 / 9.4) + stable config. */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      notifications: {
        weeklyInsight: true,
        monthlyAudit: true,
        horseAlerts: true,
      },
      capacity: 12,
      onboarded: false,
      toggle: (key) =>
        set((s) => ({
          notifications: { ...s.notifications, [key]: !s.notifications[key] },
        })),
      setCapacity: (n) => set({ capacity: Math.max(1, Math.min(60, Math.round(n))) }),
      completeOnboarding: () => set({ onboarded: true }),
      resetOnboarding: () => set({ onboarded: false }),
    }),
    { name: "be-stable-settings", version: 3 },
  ),
);
