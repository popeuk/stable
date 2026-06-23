"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  DirectExpense,
  Horse,
  Revenue,
  SharedExpense,
  StableData,
} from "@/lib/domain/types";
import { buildDemoData } from "@/lib/data/demo-data";

/**
 * Client-side data store. In the full product this is the IndexedDB-backed
 * local store fronting a Supabase sync layer (section 13). Here it persists
 * to localStorage so the app is fully usable offline / standalone, and is
 * seeded with the demo stable on first run.
 */
interface DataState extends StableData {
  hydrated: boolean;
  addRevenue: (r: Omit<Revenue, "id" | "stableId">) => void;
  addDirectExpense: (e: Omit<DirectExpense, "id" | "stableId">) => void;
  addSharedExpense: (e: Omit<SharedExpense, "id" | "stableId">) => void;
  addHorse: (h: Omit<Horse, "id" | "stableId" | "isArchived">) => void;
  archiveHorse: (id: string) => void;
  deleteHorse: (id: string) => void;
  resetToDemo: () => void;
}

const STABLE_ID = "demo-stable";

function id(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useDataStore = create<DataState>()(
  persist(
    (set) => ({
      ...buildDemoData(),
      hydrated: false,

      addRevenue: (r) =>
        set((s) => ({
          revenues: [...s.revenues, { ...r, id: id("rev"), stableId: STABLE_ID }],
        })),

      addDirectExpense: (e) =>
        set((s) => ({
          directExpenses: [
            ...s.directExpenses,
            { ...e, id: id("dexp"), stableId: STABLE_ID },
          ],
        })),

      addSharedExpense: (e) =>
        set((s) => ({
          sharedExpenses: [
            ...s.sharedExpenses,
            { ...e, id: id("shared"), stableId: STABLE_ID },
          ],
        })),

      addHorse: (h) =>
        set((s) => ({
          horses: [
            ...s.horses,
            { ...h, id: id("horse"), stableId: STABLE_ID, isArchived: false },
          ],
        })),

      archiveHorse: (horseId) =>
        set((s) => ({
          horses: s.horses.map((h) =>
            h.id === horseId ? { ...h, isArchived: true } : h,
          ),
        })),

      deleteHorse: (horseId) =>
        set((s) => ({
          horses: s.horses.filter((h) => h.id !== horseId),
          revenues: s.revenues.filter((r) => r.horseId !== horseId),
          directExpenses: s.directExpenses.filter((e) => e.horseId !== horseId),
          sharedExpenses: s.sharedExpenses.map((se) => ({
            ...se,
            allocations: se.allocations.filter((a) => a.horseId !== horseId),
          })),
        })),

      resetToDemo: () => set({ ...buildDemoData() }),
    }),
    {
      name: "be-stable-data",
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);
