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
  Service,
  StableData,
  Tariffs,
  TeamMember,
} from "@/lib/domain/types";
import type { CareEvent } from "@/lib/domain/care";
import { CARE_META } from "@/lib/domain/care";
import type { Rhythm } from "@/lib/domain/rhythm";
import { materializeRhythms } from "@/lib/domain/rhythm";
import { ensurePensions } from "@/lib/domain/autopilot";
import { buildDemoData } from "@/lib/data/demo-data";
import { enqueueMutation } from "@/lib/data/sync";
import type { ActionState, Person, PersonRole, Seance, TeamTask } from "@/lib/domain/types";
import { revenuesForSeance } from "@/lib/domain/seances";
import { distribute } from "@/lib/domain/distribution";
import { addDays as addDaysIso, diffDays } from "@/lib/domain/care";

/**
 * Client-side data store. In the full product this is the IndexedDB-backed
 * local store fronting a Supabase sync layer (section 13). Here it persists
 * to localStorage so the app is fully usable offline / standalone, and is
 * seeded with the demo stable on first run.
 */
interface DataState extends StableData {
  hydrated: boolean;
  /**
   * Les pensions auto-postées que le gérant a supprimées : on ne les
   * recrée jamais (il sait pourquoi il les a enlevées).
   */
  autopilotDismissed?: string[];
  /** Un rythme hebdomadaire : planifié une fois, généré chaque semaine. */
  addRhythm: (r: Omit<Rhythm, "id" | "stableId">) => void;
  deleteRhythm: (id: string) => void;
  /** Un tarif de la grille (vide = pas de prix par défaut). */
  setTariff: (key: keyof Tariffs, value: number | undefined) => void;
  /** Une prestation libre (balade, transport…) avec son prix par défaut. */
  addService: (s: Omit<Service, "id">) => void;
  deleteService: (id: string) => void;
  /** Un membre de l'équipe : employé ou prestataire, assignable aux tâches. */
  addTeamMember: (m: Omit<TeamMember, "id">) => void;
  deleteTeamMember: (id: string) => void;
  /**
   * L'autopilote : poste les pensions du mois et matérialise les rythmes
   * de la semaine. Idempotent — appelé à l'ouverture, il ne crée que ce
   * qui manque et ne touche à rien d'existant.
   */
  runAutopilot: (today: string) => void;
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
  /**
   * Change la pension d'un cheval : le contrat, et la pension déjà postée
   * ce mois-ci par l'autopilote (sinon le ticket du mois mentirait).
   */
  setPension: (horseId: string, amount: number, monthKey: string) => void;
  /**
   * Une facture commune mensuelle, réglée une fois : elle devient une charge
   * récurrente partagée à partir du mois donné, et remplace ce qui avait été
   * saisi pour ce mois-là dans la même catégorie.
   */
  setMonthlyCharge: (categoryId: string, label: string, amount: number, period: { year: number; month: number }) => void;

  /* ---- Planning, validation, facturation, équipe (octobre 2026) ---- */
  /** Trouve une personne par son nom, ou la crée. Rend son identifiant. */
  ensurePerson: (name: string, role: PersonRole) => string;
  updatePerson: (id: string, patch: Partial<Omit<Person, "id">>) => void;
  /** Crée une séance, ou une série (une séance par date). */
  addSeances: (base: Omit<Seance, "id" | "date" | "rev" | "status" | "seriesId">, dates: string[]) => void;
  /** Modifie une séance ; la portée reporte seulement ce qui a changé. */
  updateSeance: (id: string, patch: Partial<Omit<Seance, "id" | "seriesId" | "rev">>, scope: "one" | "following" | "all") => void;
  deleteSeance: (id: string, scope: "one" | "following" | "all") => void;
  /** Valide : présences pointées, recettes créées au prix figé. */
  validateSeance: (id: string, presence: Record<string, boolean>, chargeAbsent?: boolean) => void;
  unvalidateSeance: (id: string) => void;
  cancelSeance: (id: string, reason: string) => void;
  /** Refacture une dépense au propriétaire : une recette du même montant. */
  rebillExpense: (expenseId: string) => void;
  unrebillExpense: (expenseId: string) => void;
  setActionStatus: (id: string, status: ActionState["status"]) => void;
  addTask: (t: Omit<TeamTask, "id" | "sort" | "checklist" | "comments"> & Partial<Pick<TeamTask, "checklist" | "comments">>) => void;
  updateTask: (id: string, patch: Partial<Omit<TeamTask, "id">>) => void;
  /** Déplace une carte ; posée dans « Fait » avec un coût, elle crée la facture commune. */
  moveTask: (id: string, listId: string) => void;
  deleteTask: (id: string) => void;
  addPayment: (payer: string, month: string, amount: number) => void;
  removePayments: (payer: string, month: string) => void;
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
        set((s) => ({
          revenues: s.revenues.filter((r) => r.id !== rid),
          // Une pension auto-postée supprimée ne revient jamais.
          autopilotDismissed: rid.startsWith("rev-pension-")
            ? [...(s.autopilotDismissed ?? []), rid]
            : s.autopilotDismissed,
        }));
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

      addRhythm: (r) =>
        set((s) => ({
          rhythms: [...(s.rhythms ?? []), { ...r, id: id("rh"), stableId: STABLE_ID }],
        })),

      deleteRhythm: (rid) =>
        set((s) => ({
          rhythms: (s.rhythms ?? []).filter((r) => r.id !== rid),
          // Les séances futures déjà générées par ce rythme s'en vont avec.
          careEvents: (s.careEvents ?? []).filter(
            (e) => !(e.pending && e.groupId?.startsWith(`rh-${rid}-`)),
          ),
        })),

      addService: (svc) =>
        set((s) => ({
          services: [...(s.services ?? []), { ...svc, id: id("svc"), name: svc.name.trim() }],
        })),

      deleteService: (sid) =>
        set((s) => ({ services: (s.services ?? []).filter((x) => x.id !== sid) })),

      addTeamMember: (m) =>
        set((s) => ({
          team: [...(s.team ?? []), { ...m, id: id("tm"), name: m.name.trim() }],
        })),

      deleteTeamMember: (mid) =>
        set((s) => ({ team: (s.team ?? []).filter((x) => x.id !== mid) })),

      setTariff: (key, value) =>
        set((s) => ({
          tariffs: { ...(s.tariffs ?? {}), [key]: value && value > 0 ? value : undefined },
        })),

      runAutopilot: (today) =>
        set((s) => {
          const pensions = ensurePensions(s, today, s.autopilotDismissed ?? []);
          const { events, advanced } = materializeRhythms(
            s.rhythms ?? [],
            s.horses,
            today,
          );
          if (pensions.length === 0 && events.length === 0 && advanced.length === 0) return s;
          for (const p of pensions) enqueueMutation("insert", "revenues", { ...p });
          const until = new Map(advanced.map((a) => [a.id, a.materializedUntil]));
          return {
            revenues: pensions.length ? [...s.revenues, ...pensions] : s.revenues,
            careEvents: events.length ? [...(s.careEvents ?? []), ...events] : s.careEvents,
            rhythms: advanced.length
              ? (s.rhythms ?? []).map((r) =>
                  until.has(r.id) ? { ...r, materializedUntil: until.get(r.id)! } : r,
                )
              : s.rhythms,
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

      setPension: (horseId, amount, monthKey) =>
        set((s) => {
          const value = Math.max(0, Math.round(amount));
          const rid = `rev-pension-${horseId}-${monthKey}`;
          return {
            horses: s.horses.map((h) => (h.id === horseId ? { ...h, pension: value } : h)),
            revenues: s.revenues.map((r) => (r.id === rid ? { ...r, amount: value } : r)),
          };
        }),

      setMonthlyCharge: (categoryId, label, amount, period) =>
        set((s) => {
          const start = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
          const value = Math.max(0, Math.round(amount));
          const sharedExpenses = s.sharedExpenses.filter(
            (e) => !(e.categoryId === categoryId && e.periodYear === period.year && e.periodMonth === period.month),
          );
          // L'ancienne charge s'arrête au mois précédent : le passé ne bouge pas.
          const prevEnd = new Date(Date.UTC(period.year, period.month - 1, 0)).toISOString().slice(0, 10);
          const recurringExpenses = (s.recurringExpenses ?? []).flatMap((r) => {
            if (!(r.isShared && r.categoryId === categoryId)) return [r];
            if (r.startDate < start) return [{ ...r, endDate: r.endDate && r.endDate < prevEnd ? r.endDate : prevEnd }];
            return [];
          });
          if (value > 0) {
            recurringExpenses.push({
              id: id("rec"),
              stableId: STABLE_ID,
              label,
              amount: value,
              categoryId,
              isShared: true,
              distributionMode: "equal",
              frequency: "monthly",
              startDate: start,
              endDate: null,
              source: "manual",
            });
          }
          return { sharedExpenses, recurringExpenses };
        }),

      ensurePerson: (name, role) => {
        const n = name.trim();
        const found = (get().people ?? []).find((p) => p.name.toLowerCase() === n.toLowerCase());
        if (found) {
          if (!found.active) set((s) => ({ people: (s.people ?? []).map((p) => (p.id === found.id ? { ...p, active: true } : p)) }));
          return found.id;
        }
        const pid = id("pers");
        set((s) => ({ people: [...(s.people ?? []), { id: pid, name: n, role, active: true }] }));
        return pid;
      },

      updatePerson: (pid, patch) => set((s) => ({ people: (s.people ?? []).map((p) => (p.id === pid ? { ...p, ...patch } : p)) })),

      addSeances: (base, dates) =>
        set((s) => {
          const seriesId = dates.length > 1 ? id("serie") : undefined;
          const created: Seance[] = dates.map((date) => ({ ...base, id: id("seance"), date, status: "planned", seriesId, rev: 1 }));
          return { seances: [...(s.seances ?? []), ...created] };
        }),

      updateSeance: (sid, patch, scope) =>
        set((s) => {
          const all = s.seances ?? [];
          const target = all.find((x) => x.id === sid);
          if (!target) return s;
          const shift = patch.date ? diffDays(target.date, patch.date) : 0;
          const inScope = (x: Seance) =>
            x.id === sid ||
            (!!target.seriesId && x.seriesId === target.seriesId && (scope === "all" || (scope === "following" && x.date >= target.date)));
          return {
            seances: all.map((x) => {
              if (!inScope(x) || (scope === "one" && x.id !== sid)) return x;
              const { date: _d, ...rest } = patch;
              void _d;
              const next: Seance = { ...x, ...(x.id === sid ? patch : rest), rev: x.rev + 1 };
              if (shift && x.id !== sid) next.date = addDaysIso(x.date, shift);
              return next;
            }),
          };
        }),

      deleteSeance: (sid, scope) =>
        set((s) => {
          const all = s.seances ?? [];
          const target = all.find((x) => x.id === sid);
          if (!target) return s;
          const gone = new Set(
            all
              .filter((x) => x.id === sid || (scope !== "one" && !!target.seriesId && x.seriesId === target.seriesId && (scope === "all" || x.date >= target.date)))
              .map((x) => x.id),
          );
          return {
            seances: all.filter((x) => !gone.has(x.id)),
            revenues: s.revenues.filter((r) => !r.seanceId || !gone.has(r.seanceId)),
          };
        }),

      validateSeance: (sid, presence, chargeAbsent) =>
        set((s) => {
          const all = s.seances ?? [];
          const target = all.find((x) => x.id === sid);
          if (!target) return s;
          const done: Seance = {
            ...target,
            status: "done",
            chargeAbsent: !!chargeAbsent,
            participants: target.participants.map((p) => ({ ...p, present: presence[p.personId] ?? true })),
            rev: target.rev + 1,
          };
          const revs = revenuesForSeance(done, s, () => id("rev"), STABLE_ID);
          for (const r of revs) enqueueMutation("insert", "revenues", { ...r });
          return {
            seances: all.map((x) => (x.id === sid ? done : x)),
            revenues: [...s.revenues.filter((r) => r.seanceId !== sid), ...revs],
          };
        }),

      unvalidateSeance: (sid) =>
        set((s) => ({
          seances: (s.seances ?? []).map((x) =>
            x.id === sid ? { ...x, status: "planned", cancelReason: undefined, participants: x.participants.map((p) => ({ ...p, present: undefined })), rev: x.rev + 1 } : x,
          ),
          revenues: s.revenues.filter((r) => r.seanceId !== sid),
        })),

      cancelSeance: (sid, reason) =>
        set((s) => ({
          seances: (s.seances ?? []).map((x) => (x.id === sid ? { ...x, status: "cancelled", cancelReason: reason.trim() || undefined, rev: x.rev + 1 } : x)),
          revenues: s.revenues.filter((r) => r.seanceId !== sid),
        })),

      rebillExpense: (eid) =>
        set((s) => {
          const e = s.directExpenses.find((x) => x.id === eid);
          if (!e || e.rebillRevenueId) return s;
          const horse = s.horses.find((h) => h.id === e.horseId);
          const rid = id("rev");
          const rev = {
            id: rid,
            stableId: STABLE_ID,
            horseId: e.horseId,
            categoryId: s.revenueCategories.find((c) => c.name === "Refacturation")?.id,
            amount: e.amount,
            date: e.date,
            note: `Refacturation · ${e.label}`,
            source: "manual" as const,
            payer: horse?.ownerName,
            rebillOf: e.id,
          };
          enqueueMutation("insert", "revenues", rev);
          return {
            revenues: [...s.revenues, rev],
            directExpenses: s.directExpenses.map((x) => (x.id === eid ? { ...x, rebillRevenueId: rid } : x)),
          };
        }),

      unrebillExpense: (eid) =>
        set((s) => ({
          revenues: s.revenues.filter((r) => r.rebillOf !== eid),
          directExpenses: s.directExpenses.map((x) => (x.id === eid ? { ...x, rebillRevenueId: undefined } : x)),
        })),

      setActionStatus: (aid, status) =>
        set((s) => {
          const others = (s.actions ?? []).filter((a) => a.id !== aid);
          return { actions: [...others, { id: aid, status, at: new Date().toISOString() }] };
        }),

      addTask: (t) =>
        set((s) => {
          const inList = (s.tasks ?? []).filter((x) => x.listId === t.listId);
          const sort = inList.length ? Math.max(...inList.map((x) => x.sort)) + 1 : 1;
          return { tasks: [...(s.tasks ?? []), { checklist: [], comments: [], ...t, id: id("task"), sort }] };
        }),

      updateTask: (tid, patch) => set((s) => ({ tasks: (s.tasks ?? []).map((x) => (x.id === tid ? { ...x, ...patch } : x)) })),

      moveTask: (tid, listId) =>
        set((s) => {
          const task = (s.tasks ?? []).find((x) => x.id === tid);
          if (!task) return s;
          const doneList = (s.taskLists ?? []).find((l) => l.isDone)?.id;
          let sharedExpenses = s.sharedExpenses;
          let costExpenseId = task.costExpenseId;
          // Une carte avec un coût, posée dans « Fait » : la facture commune du mois.
          if (listId === doneList && task.cost && task.cost > 0 && !costExpenseId) {
            const now = new Date();
            const period = { year: now.getFullYear(), month: now.getMonth() + 1 };
            const active = s.horses.filter((h) => !h.isArchived);
            costExpenseId = id("shared");
            sharedExpenses = [
              ...sharedExpenses,
              {
                id: costExpenseId,
                stableId: STABLE_ID,
                label: task.title,
                totalAmount: task.cost,
                periodMonth: period.month,
                periodYear: period.year,
                distributionMode: "equal",
                source: "manual",
                allocations: distribute(task.cost, active, "equal", period),
              },
            ];
          }
          // Rouverte : la facture créée par la carte s'en va avec.
          if (listId !== doneList && costExpenseId && task.listId === doneList) {
            sharedExpenses = sharedExpenses.filter((e) => e.id !== costExpenseId);
            costExpenseId = undefined;
          }
          const inList = (s.tasks ?? []).filter((x) => x.listId === listId && x.id !== tid);
          const sort = inList.length ? Math.max(...inList.map((x) => x.sort)) + 1 : 1;
          return { sharedExpenses, tasks: (s.tasks ?? []).map((x) => (x.id === tid ? { ...x, listId, sort, costExpenseId } : x)) };
        }),

      deleteTask: (tid) => set((s) => ({ tasks: (s.tasks ?? []).filter((x) => x.id !== tid) })),

      addPayment: (payer, month, amount) =>
        set((s) => ({ payments: [...(s.payments ?? []), { id: id("pay"), payer, month, amount, at: new Date().toISOString() }] })),

      removePayments: (payer, month) => set((s) => ({ payments: (s.payments ?? []).filter((p) => !(p.payer === payer && p.month === month)) })),

      resetToDemo: () => set({ ...buildDemoData(), autopilotDismissed: [] }),

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
          rhythms: [],
          tariffs: {},
          services: [],
          team: [],
          people: [],
          prestations: demo.prestations,
          seances: [],
          taskLists: demo.taskLists,
          tasks: [],
          actions: [],
          payments: [],
          autopilotDismissed: [],
          revenueCategories: demo.revenueCategories,
          expenseCategories: demo.expenseCategories,
        });
      },
    }),
    {
      name: "be-stable-data",
      version: 2,
      // v2 : séances, personnes, tâches d'équipe, actions, paiements. Une
      // version 1 repart de la démo complète pour avoir des exemples cohérents.
      migrate: () => ({ ...buildDemoData(), autopilotDismissed: [] }) as never,
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);
