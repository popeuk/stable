"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  DirectExpense,
  Horse,
  RecurringExpense,
  RecurringRevenue,
  Revenue,
  SharedExpense,
  StableData,
} from "@/lib/domain/types";
import type { CareEvent } from "@/lib/domain/care";
import { CARE_META } from "@/lib/domain/care";
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
  updateHorse: (id: string, patch: Partial<Omit<Horse, "id" | "stableId">>) => void;
  archiveHorse: (id: string) => void;
  deleteHorse: (id: string) => void;
  deleteRevenue: (id: string) => void;
  deleteDirectExpense: (id: string) => void;
  deleteSharedExpense: (id: string) => void;
  /** Note un acte du carnet ; un coût saisi crée la dépense directe liée. */
  logCare: (e: Omit<CareEvent, "id" | "stableId" | "expenseId" | "revenueId">) => void;
  /**
   * Une séance pour plusieurs chevaux (cours collectif, vermifuge général…).
   * Date future ou séance à confirmer → actes en attente (pending), argent
   * différé. Date passée → actes faits, argent attribué immédiatement.
   */
  logCareMany: (
    horseIds: string[],
    base: Omit<CareEvent, "id" | "stableId" | "expenseId" | "revenueId" | "horseId" | "groupId" | "pending">,
  ) => void;
  /**
   * La feuille de présence : confirme une séance. Les présents passent au
   * carnet (date réelle) avec leur coût/recette attribués ; les absents
   * sortent de la séance.
   */
  confirmSession: (eventIds: string[], presentIds: string[], actualDate: string) => void;
  /** Supprime un acte ET sa dépense liée le cas échéant (le graphe suit). */
  deleteCareEvent: (id: string) => void;
  addRecurringExpense: (e: Omit<RecurringExpense, "id" | "stableId">) => void;
  deleteRecurringExpense: (id: string) => void;
  addRecurringRevenue: (r: Omit<RecurringRevenue, "id" | "stableId">) => void;
  deleteRecurringRevenue: (id: string) => void;
  addRevenueCategory: (name: string) => void;
  addExpenseCategory: (name: string, isDirect: boolean) => void;
  deleteRevenueCategory: (id: string) => void;
  deleteExpenseCategory: (id: string) => void;
  resetToDemo: () => void;
  startEmpty: () => void;
}

const STABLE_ID = "demo-stable";

function id(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
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

      updateHorse: (horseId, patch) =>
        set((s) => {
          const horse = s.horses.find((h) => h.id === horseId);
          if (horse) {
            enqueueMutation("update", "horses", { ...horse, ...patch, id: horseId });
          }
          return {
            horses: s.horses.map((h) => (h.id === horseId ? { ...h, ...patch } : h)),
          };
        }),

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

      logCare: (e) => get().logCareMany([e.horseId], e),

      logCareMany: (horseIds, base) =>
        set((s) => {
          const groupId = horseIds.length > 1 ? id("grp") : undefined;
          const pending = base.date > new Date().toISOString().slice(0, 10) ? true : undefined;
          let directExpenses = s.directExpenses;
          let revenues = s.revenues;
          const coursCat = s.revenueCategories.find((c) => c.name === "Cours")?.id;
          const events: CareEvent[] = horseIds.map((horseId) => {
            const careId = id("care");
            let expenseId: string | undefined;
            let revenueId: string | undefined;
            // Acte fait : l'argent est attribué tout de suite. Acte en
            // attente : l'argent viendra à la confirmation de présence.
            if (!pending && base.cost && base.cost > 0) {
              expenseId = id("dexp");
              const label = `${CARE_META[base.kind].label}${base.provider ? ` (${base.provider})` : ""}`;
              const expense = {
                id: expenseId,
                stableId: STABLE_ID,
                horseId,
                label,
                amount: base.cost,
                date: base.date,
                source: "manual" as const,
              };
              enqueueMutation("insert", "direct_expenses", expense);
              directExpenses = [...directExpenses, expense];
            }
            if (!pending && base.revenue && base.revenue > 0) {
              revenueId = id("rev");
              const rev = {
                id: revenueId,
                stableId: STABLE_ID,
                horseId,
                categoryId: coursCat,
                amount: base.revenue,
                date: base.date,
                source: "manual" as const,
              };
              enqueueMutation("insert", "revenues", rev);
              revenues = [...revenues, rev];
            }
            return { ...base, id: careId, stableId: STABLE_ID, horseId, groupId, pending, expenseId, revenueId };
          });
          return {
            directExpenses,
            revenues,
            careEvents: [...(s.careEvents ?? []), ...events],
          };
        }),

      confirmSession: (eventIds, presentIds, actualDate) =>
        set((s) => {
          const ids = new Set(eventIds);
          const present = new Set(presentIds);
          let directExpenses = s.directExpenses;
          let revenues = s.revenues;
          const coursCat = s.revenueCategories.find((c) => c.name === "Cours")?.id;
          const careEvents = (s.careEvents ?? []).flatMap((e) => {
            if (!ids.has(e.id)) return [e];
            // Absent : l'acte sort de la séance, rien n'est facturé.
            if (!present.has(e.horseId)) return [];
            // Présent : l'acte passe au carnet à la date réelle, argent lié.
            let expenseId = e.expenseId;
            let revenueId = e.revenueId;
            if (!expenseId && e.cost && e.cost > 0) {
              expenseId = id("dexp");
              const label = `${CARE_META[e.kind].label}${e.provider ? ` (${e.provider})` : ""}`;
              const expense = {
                id: expenseId,
                stableId: STABLE_ID,
                horseId: e.horseId,
                label,
                amount: e.cost,
                date: actualDate,
                source: "manual" as const,
              };
              enqueueMutation("insert", "direct_expenses", expense);
              directExpenses = [...directExpenses, expense];
            }
            if (!revenueId && e.revenue && e.revenue > 0) {
              revenueId = id("rev");
              const rev = {
                id: revenueId,
                stableId: STABLE_ID,
                horseId: e.horseId,
                categoryId: coursCat,
                amount: e.revenue,
                date: actualDate,
                source: "manual" as const,
              };
              enqueueMutation("insert", "revenues", rev);
              revenues = [...revenues, rev];
            }
            return [{ ...e, date: actualDate, pending: undefined, expenseId, revenueId }];
          });
          return { careEvents, directExpenses, revenues };
        }),

      deleteCareEvent: (cid) =>
        set((s) => {
          const target = (s.careEvents ?? []).find((e) => e.id === cid);
          return {
            careEvents: (s.careEvents ?? []).filter((e) => e.id !== cid),
            directExpenses: target?.expenseId
              ? s.directExpenses.filter((d) => d.id !== target.expenseId)
              : s.directExpenses,
            revenues: target?.revenueId
              ? s.revenues.filter((r) => r.id !== target.revenueId)
              : s.revenues,
          };
        }),

      addRecurringExpense: (e) =>
        set((s) => ({
          recurringExpenses: [
            ...(s.recurringExpenses ?? []),
            { ...e, id: id("rec"), stableId: STABLE_ID },
          ],
        })),

      deleteRecurringExpense: (rid) =>
        set((s) => ({
          recurringExpenses: (s.recurringExpenses ?? []).filter((e) => e.id !== rid),
        })),

      addRecurringRevenue: (r) =>
        set((s) => ({
          recurringRevenues: [
            ...(s.recurringRevenues ?? []),
            { ...r, id: id("recrev"), stableId: STABLE_ID },
          ],
        })),

      deleteRecurringRevenue: (rid) =>
        set((s) => ({
          recurringRevenues: (s.recurringRevenues ?? []).filter((e) => e.id !== rid),
        })),

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

      // Empty stable, keeping the default categories — the from-zero experience.
      startEmpty: () => {
        const demo = buildDemoData();
        set({
          horses: [],
          revenues: [],
          directExpenses: [],
          sharedExpenses: [],
          recurringExpenses: [],
          recurringRevenues: [],
          careEvents: [],
          revenueCategories: demo.revenueCategories,
          expenseCategories: demo.expenseCategories,
        });
      },
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
