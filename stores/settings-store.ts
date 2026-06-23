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
  toggle: (key: keyof NotificationPrefs) => void;
}

/** Granular, opt-in notification preferences (spec 1.3 / 9.4). */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      notifications: {
        weeklyInsight: true,
        monthlyAudit: true,
        horseAlerts: true,
      },
      toggle: (key) =>
        set((s) => ({
          notifications: { ...s.notifications, [key]: !s.notifications[key] },
        })),
    }),
    { name: "be-stable-settings", version: 1 },
  ),
);
