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
import { enqueueMutation } from "@/lib/data/sync";

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
  deleteRevenue: (id: string) => void;
  deleteDirectExpense: (id: string) => void;
  deleteSharedExpense: (id: string) => void;
  addRevenueCategory: (name: string) => void;
  addExpenseCategory: (name: string, isDirect: boolean) => void;
  deleteRevenueCategory: (id: string) => void;
  deleteExpenseCategory: (id: string) => void;
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

      addRevenue: (r) => {
        const entity = { ...r, id: id("rev"), stableId: STABLE_ID };
        enqueueMutation("insert", "revenues", entity);
        set((s) => ({ revenues: [...s.revenues, entity] }));
      },

      addDirectExpense: (e) => {
        const entity = { ...e, id: id("dexp"), stableId: STABLE_ID };
        enqueueMutation("insert", "direct_expenses", entity);
        set((s) => ({ directExpenses: [...s.directExpenses, entity] }));
      },

      addSharedExpense: (e) => {
        const entity = { ...e, id: id("shared"), stableId: STABLE_ID };
        enqueueMutation("insert", "shared_expenses", entity);
        set((s) => ({ sharedExpenses: [...s.sharedExpenses, entity] }));
      },

      addHorse: (h) => {
        const entity = {
          ...h,
          id: id("horse"),
          stableId: STABLE_ID,
          isArchived: false,
        };
        enqueueMutation("insert", "horses", entity);
        set((s) => ({ horses: [...s.horses, entity] }));
      },

      archiveHorse: (horseId) =>
        set((s) => {
          const horse = s.horses.find((h) => h.id === horseId);
          if (horse) {
            enqueueMutation("update", "horses", { ...horse, isArchived: true });
          }
          return {
            horses: s.horses.map((h) =>
              h.id === horseId ? { ...h, isArchived: true } : h,
            ),
          };
        }),

      deleteHorse: (horseId) => {
        enqueueMutation("delete", "horses", { id: horseId });
        set((s) => ({
          horses: s.horses.filter((h) => h.id !== horseId),
          revenues: s.revenues.filter((r) => r.horseId !== horseId),
          directExpenses: s.directExpenses.filter((e) => e.horseId !== horseId),
          sharedExpenses: s.sharedExpenses.map((se) => ({
            ...se,
            allocations: se.allocations.filter((a) => a.horseId !== horseId),
          })),
        }));
      },

      deleteRevenue: (rid) => {
        enqueueMutation("delete", "revenues", { id: rid });
        set((s) => ({ revenues: s.revenues.filter((r) => r.id !== rid) }));
      },

      deleteDirectExpense: (eid) => {
        enqueueMutation("delete", "direct_expenses", { id: eid });
        set((s) => ({ directExpenses: s.directExpenses.filter((e) => e.id !== eid) }));
      },

      deleteSharedExpense: (sid) => {
        enqueueMutation("delete", "shared_expenses", { id: sid });
        set((s) => ({ sharedExpenses: s.sharedExpenses.filter((e) => e.id !== sid) }));
      },

      addRevenueCategory: (name) =>
        set((s) =>
          s.revenueCategories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())
            ? s
            : { revenueCategories: [...s.revenueCategories, { id: id("rev"), name: name.trim() }] },
        ),

      addExpenseCategory: (name, isDirect) =>
        set((s) =>
          s.expenseCategories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())
            ? s
            : {
                expenseCategories: [
                  ...s.expenseCategories,
                  { id: id("exp"), name: name.trim(), isDirect },
                ],
              },
        ),

      deleteRevenueCategory: (catId) =>
        set((s) => ({ revenueCategories: s.revenueCategories.filter((c) => c.id !== catId) })),

      deleteExpenseCategory: (catId) =>
        set((s) => ({ expenseCategories: s.expenseCategories.filter((c) => c.id !== catId) })),

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
