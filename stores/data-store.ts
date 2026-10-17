"use client";

import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import { vault, wasFresh } from "@/lib/account/vault";
import { getSession } from "@/lib/account/session";
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
import type { Holding } from "@/lib/domain/registre";
import { CARE_META } from "@/lib/domain/care";
import type { Rhythm } from "@/lib/domain/rhythm";
import { materializeRhythms } from "@/lib/domain/rhythm";
import { ensurePensions, pensionRevenueId, premierMoisARattraper } from "@/lib/domain/autopilot";
import { buildDemoData } from "@/lib/data/demo-data";
import { enqueueMutation } from "@/lib/data/sync";
import type { ActionState, BillingInfo, Invoice, PaymentMethod, Person, PersonRole, Prestation, Seance, TeamTask } from "@/lib/domain/types";
import { emettre, type Brouillon } from "@/lib/domain/facture";
import { revenuesForSeance } from "@/lib/domain/seances";
import { sansPrixDExemple } from "@/lib/domain/ajouter";
import { aCompter, rienACompter } from "@/lib/domain/compte-auto";
import { addDays as addDaysIso, diffDays } from "@/lib/domain/care";
import { localToday } from "@/lib/utils/local-date";
import { avecProprio, changerProprio, nomConnu, renommerClient, retirerClient } from "@/lib/domain/proprio";
import { arreterRecurrentes, migrerSejours, presentDans } from "@/lib/domain/presence";
import { avecSejours, changerArrivee, changerInfosSejour, compteDepuis, partirLe, revenirLe, type InfosEntree, type InfosSortie } from "@/lib/domain/sejours";
import { currentPeriod } from "@/lib/utils/period";
import { POSTES_VERSION, ajouterPostesManquants } from "@/lib/domain/postes-communs";
import { avecCategoriesSysteme, categorieSysteme } from "@/lib/domain/categories";
import { nettoyer, vide } from "@/lib/domain/valider";
import type { MontantSaisi } from "@/lib/domain/types";

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
  /** La liste de postes communs déjà proposée à cette écurie (postes-communs.ts). */
  postesCommuns?: number;
  /** Le dernier mois (AAAA-MM) où l'autopilote a posté les pensions : les mois d'après sont rattrapés. */
  pensionsAu?: string;
  /**
   * Des données enregistrées abîmées, lues au chargement : ce qui a été écarté
   * (en mots) et la copie d'origine. L'écran de secours s'affiche tant qu'il
   * est là (components/bs/secours).
   */
  secours?: { problemes: string[]; copie: string };
  /** Sortir de l'écran de secours : garder ce qui reste, ou repartir (vide, ou l'exemple en démo). */
  quitterSecours: (mode: "garder" | "repartir") => void;
  /** Un rythme hebdomadaire : planifié une fois, généré chaque semaine. */
  addRhythm: (r: Omit<Rhythm, "id" | "stableId">) => void;
  deleteRhythm: (id: string) => void;
  /** Le lieu de détention et son détenteur (registre d'élevage). Un champ vide s'efface. */
  setHolding: (patch: Partial<Holding>) => void;
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
  /**
   * Tout compte : les séances et soins encore prévus dont l'heure est passée
   * comptent tout seuls (tous présents, à leur date). Idempotent, sans
   * message. Renvoie combien d'éléments ont compté.
   */
  compterLePasse: (today: string, nowHHMM: string) => number;
  addRevenue: (r: Omit<Revenue, "id" | "stableId">) => void;
  addDirectExpense: (e: Omit<DirectExpense, "id" | "stableId">) => void;
  addSharedExpense: (e: Omit<SharedExpense, "id" | "stableId">) => void;
  /** Rend l'id du cheval. Son propriétaire devient une personne du carnet. */
  addHorse: (h: Omit<Horse, "id" | "stableId" | "isArchived">) => string;
  updateHorse: (id: string, patch: Partial<Omit<Horse, "id" | "stableId">>) => void;
  /**
   * Le cheval quitte l'écurie ce jour-là (aujourd'hui par défaut) : il garde
   * son argent des mois où il était là, il ne compte plus après, sa pension
   * n'est plus postée. Il reste dans les chevaux partis.
   */
  archiveHorse: (id: string, date?: string, infos?: InfosSortie) => void;
  /**
   * Un cheval parti revient ce jour-là (aujourd'hui par défaut) : un nouveau
   * séjour commence, les précédents ne bougent pas (lib/domain/sejours).
   */
  restoreHorse: (id: string, date?: string, infos?: InfosEntree) => void;
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
  /** Supprime une charge récurrente notée par erreur (le passé aussi). */
  deleteRecurringExpense: (id: string) => void;
  /**
   * Arrête une charge récurrente : elle ne compte plus après ce jour (fin
   * du mois précédent si elle n'a pas encore compté ce mois). Le passé reste.
   */
  stopRecurringExpense: (id: string, today?: string) => void;
  addRecurringRevenue: (r: Omit<RecurringRevenue, "id" | "stableId">) => void;
  deleteRecurringRevenue: (id: string) => void;
  /** Arrête une recette récurrente : même règle, le passé reste. */
  stopRecurringRevenue: (id: string, today?: string) => void;
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
  /** `saisi` : le montant tel que tapé, quand il est connu à l'année ou en plusieurs fois ; `amount` est son équivalent par mois. */
  setMonthlyCharge: (categoryId: string, label: string, amount: number, period: { year: number; month: number }, saisi?: MontantSaisi) => void;

  /* ---- Planning, validation, facturation, équipe (octobre 2026) ---- */
  /** Trouve une personne par son nom, ou la crée. Rend son identifiant. */
  ensurePerson: (name: string, role: PersonRole) => string;
  /** Change le nom aussi sur ses chevaux, ses recettes et ses paiements. */
  updatePerson: (id: string, patch: Partial<Omit<Person, "id">>) => void;
  /**
   * Rattache un cheval à un propriétaire (créé une seule fois s'il n'existe
   * pas), ou le détache (null). Le passé reste au nom d'avant. Rend une
   * fonction qui annule exactement ce changement.
   */
  setOwner: (horseId: string, name: string | null) => () => void;
  /** Retire un client : ses chevaux restent, sans propriétaire. */
  deletePerson: (id: string) => void;
  /** Les prestations vendues : ajouter, modifier (prix, nom, actif), retirer. */
  addPrestation: (p: Omit<Prestation, "id" | "active">) => string;
  updatePrestation: (id: string, patch: Partial<Omit<Prestation, "id">>) => void;
  /** Retire une prestation jamais utilisée ; sinon la met en pause (l'historique reste). */
  removePrestation: (id: string) => "supprimee" | "en_pause";
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
  /** Un paiement reçu (tout ou une partie du mois). Avec `seanceId` : payé sur place pour cette séance. Renvoie son id. */
  addPayment: (payer: string, month: string, amount: number, seanceId?: string, how?: { method?: PaymentMethod; chequeNumber?: string }) => string;
  /** Les infos de facturation de l'écurie (nom, adresse, SIRET, TVA). */
  setBilling: (patch: Partial<BillingInfo>) => void;
  /**
   * Émet une facture : le numéro suivant de l'année, jamais réutilisé, et
   * un contenu figé. Rend la facture enregistrée.
   */
  issueInvoice: (contenu: NonNullable<Brouillon["facture"]>, today: string, stableName: string) => Invoice;
  /** Retire un paiement précis (« Annuler »). */
  removePayment: (id: string) => void;
  removePayments: (payer: string, month: string) => void;
  /** Une note datée sur un client, en tête de ses notes. */
  addNote: (personId: string, text: string, at?: string) => void;
}

const STABLE_ID = "demo-stable";

/** Une copie lisible de ce qui était enregistré, pour « Exporter ce qui reste ». */
const copieDe = (x: unknown) => {
  try {
    return JSON.stringify(x);
  } catch {
    return "";
  }
};
/** Ce qu'une lecture abîmée a écarté, entre la migration et la fusion. */
let abime: { problemes: string[]; copie: string } | undefined;
/** Un enregistrement qui ne se lit même pas (JSON cassé) arrive tel quel sous cette clé. */
const BRUT = "__brut";
/** Le coffre du compte, lu sans jamais tomber sur un texte cassé. */
const stockageSur: PersistStorage<unknown> = {
  getItem: async (name) => {
    const str = await vault.getItem(name);
    if (str === null || str === undefined) return null;
    try {
      return JSON.parse(str);
    } catch {
      return { state: { [BRUT]: str }, version: 5 };
    }
  },
  setItem: (name, value) => vault.setItem(name, JSON.stringify(value)),
  removeItem: (name) => vault.removeItem(name),
};

/**
 * Les données d'une version d'avant, mises à la version d'aujourd'hui. Sert
 * au chargement et à la reprise d'une sauvegarde. Rien n'est perdu.
 */
export function migrerDonnees(old: unknown, v: number): StableData {
  if (v < 2) return { ...buildDemoData(), autopilotDismissed: [] } as StableData;
  let d = migrerSejours(old as StableData);
  if (v < 4 && getSession()?.kind !== "demo" && d.prestations) {
    d = { ...d, prestations: sansPrixDExemple(d.prestations, buildDemoData().prestations ?? [], d.seances ?? []) };
  }
  return avecCategoriesSysteme(d);
}

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
        const s0 = get();
        const today = localToday();
        const owner = h.ownerName?.trim() ? nomConnu(s0, h.ownerName) : undefined;
        const entry = h.entryDate || today;
        // Arrivé avant ce mois-ci : il compte dans l'argent à partir de ce mois-ci, la vraie date va au registre.
        const entity: Horse = avecSejours(
          { ...h, ownerName: owner, id: id("horse"), stableId: STABLE_ID, isArchived: false, entryDate: entry, exitDate: null },
          [{ entry, countFrom: compteDepuis(entry, today), origin: h.origin, entryReason: h.entryReason }],
        );
        if (!owner) delete entity.ownerName;
        enqueueMutation("insert", "horses", { ...entity });
        set((s) => ({
          horses: [...s.horses, entity],
          ...(owner ? { people: avecProprio(s.people ?? [], owner, () => id("pers")) } : {}),
        }));
        // Sa pension du mois compte tout de suite, sans attendre le prochain chargement.
        get().runAutopilot(today);
        return entity.id;
      },

      updateHorse: (horseId, rawPatch) => {
        // Le propriétaire passe par setOwner : le passé reste au nom d'avant.
        let patch = rawPatch;
        if ("ownerName" in rawPatch) {
          const { ownerName, ...rest } = rawPatch;
          const cur = get().horses.find((h) => h.id === horseId)?.ownerName?.trim() || undefined;
          if ((ownerName?.trim() || undefined) !== cur) get().setOwner(horseId, ownerName ?? null);
          patch = rest;
        }
        if (!Object.keys(patch).length) return;
        set((s) => {
          const horse = s.horses.find((h) => h.id === horseId);
          if (!horse) return s;
          // L'arrivée, la provenance, la destination et les motifs sont ceux du séjour en cours.
          const { entryDate, exitDate: _x, isArchived: _a, stays: _s, origin, entryReason, destination, exitReason, ...rest } = patch;
          void _x;
          void _a;
          void _s;
          let next: Horse = { ...horse, ...rest };
          if (entryDate) next = changerArrivee(next, entryDate, localToday());
          const infos = Object.fromEntries(Object.entries({ origin, entryReason, destination, exitReason }).filter(([k]) => k in patch));
          if (Object.keys(infos).length) next = changerInfosSejour(next, infos);
          enqueueMutation("update", "horses", { ...next });
          return { horses: s.horses.map((h) => (h.id === horseId ? next : h)) };
        });
      },

      archiveHorse: (horseId, date, infos) =>
        set((s) => {
          const horse = s.horses.find((h) => h.id === horseId);
          if (!horse) return s;
          const today = localToday();
          const next = partirLe(horse, date ?? today, today, infos);
          enqueueMutation("update", "horses", { ...next });
          // Parti avant ce mois-ci : sa pension de ce mois, postée toute seule et pas encore facturée, s'en va.
          const rid = pensionRevenueId(horseId, today.slice(0, 7));
          const facturee = (s.invoices ?? []).some((i) => i.revenueIds.includes(rid));
          const retirer = !presentDans(next, currentPeriod(new Date(`${today}T12:00:00`))) && !facturee && s.revenues.some((r) => r.id === rid);
          return {
            horses: s.horses.map((h) => (h.id === horseId ? next : h)),
            ...(retirer ? { revenues: s.revenues.filter((r) => r.id !== rid) } : {}),
          };
        }),

      restoreHorse: (horseId, date, infos) => {
        const today = localToday();
        set((s) => {
          const horse = s.horses.find((h) => h.id === horseId);
          if (!horse) return s;
          const next = revenirLe(horse, date ?? today, today, infos);
          enqueueMutation("update", "horses", { ...next });
          return { horses: s.horses.map((h) => (h.id === horseId ? next : h)) };
        });
        // Sa pension du mois, s'il en a une et qu'elle n'est pas déjà là.
        get().runAutopilot(today);
      },

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
        set((s) => {
          // Sa refacturation au propriétaire s'en va avec, et le soin lié perd sa dépense.
          const gone = s.revenues.filter((r) => r.rebillOf === eid);
          for (const r of gone) enqueueMutation("delete", "revenues", { id: r.id });
          return {
            directExpenses: s.directExpenses.filter((e) => e.id !== eid),
            revenues: gone.length ? s.revenues.filter((r) => r.rebillOf !== eid) : s.revenues,
            careEvents: (s.careEvents ?? []).some((c) => c.expenseId === eid)
              ? (s.careEvents ?? []).map((c) => (c.expenseId === eid ? { ...c, expenseId: undefined } : c))
              : s.careEvents,
          };
        });
      },

      deleteSharedExpense: (sid) => {
        enqueueMutation("delete", "shared_expenses", { id: sid });
        set((s) => ({ sharedExpenses: s.sharedExpenses.filter((e) => e.id !== sid) }));
      },

      logCare: (e) => get().logCareMany([e.horseId], e),

      logCareMany: (horseIds, base) => {
        let aRefacturer: string[] = [];
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
          // Un soin fait à refacturer : sa dépense existe, on refacture tout de suite.
          // (seulement pour un cheval qui a un propriétaire)
          const proprio = (hid: string) => !!s.horses.find((h) => h.id === hid)?.ownerName;
          aRefacturer = base.refacturer ? events.filter((e) => e.expenseId && proprio(e.horseId)).map((e) => e.expenseId!) : [];
          return {
            directExpenses,
            revenues,
            careEvents: [...(s.careEvents ?? []), ...events],
          };
        });
        for (const eid of aRefacturer) get().rebillExpense(eid);
      },

      confirmSession: (eventIds, presentIds, actualDate) => {
        const aRefacturer: string[] = [];
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
            // Refacturer au propriétaire, décidé à la saisie : ça se fait maintenant qu'il compte.
            if (e.refacturer && expenseId && s.horses.find((h) => h.id === e.horseId)?.ownerName) aRefacturer.push(expenseId);
            return [{ ...e, date: actualDate, pending: undefined, expenseId, revenueId }];
          });
          return { careEvents, directExpenses, revenues };
        });
        for (const eid of aRefacturer) get().rebillExpense(eid);
      },

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

      setHolding: (patch) =>
        set((s) => {
          const next: Holding = { ...(s.holding ?? {}) };
          for (const [k, v] of Object.entries(patch) as [keyof Holding, string | undefined][]) {
            const t = v?.trim();
            if (t) next[k] = t;
            else delete next[k];
          }
          return { holding: next };
        }),

      setTariff: (key, value) =>
        set((s) => ({
          tariffs: { ...(s.tariffs ?? {}), [key]: value && value > 0 ? value : undefined },
        })),

      runAutopilot: (today) =>
        set((s) => {
          // Les mois où l'app n'a pas été ouverte sont rattrapés, sans doublon.
          const depuis = premierMoisARattraper(s, today, s.pensionsAu);
          const pensions = ensurePensions(s, today, s.autopilotDismissed ?? [], depuis);
          const pensionsAu = today.slice(0, 7);
          const { events, advanced } = materializeRhythms(
            s.rhythms ?? [],
            s.horses,
            today,
          );
          if (pensions.length === 0 && events.length === 0 && advanced.length === 0) return s.pensionsAu === pensionsAu ? s : { pensionsAu };
          for (const p of pensions) enqueueMutation("insert", "revenues", { ...p });
          const until = new Map(advanced.map((a) => [a.id, a.materializedUntil]));
          return {
            pensionsAu,
            revenues: pensions.length ? [...s.revenues, ...pensions] : s.revenues,
            careEvents: events.length ? [...(s.careEvents ?? []), ...events] : s.careEvents,
            rhythms: advanced.length
              ? (s.rhythms ?? []).map((r) =>
                  until.has(r.id) ? { ...r, materializedUntil: until.get(r.id)! } : r,
                )
              : s.rhythms,
          };
        }),

      compterLePasse: (today, nowHHMM) => {
        const plan = aCompter(get(), today, nowHHMM);
        if (rienACompter(plan)) return 0;
        for (const sid of plan.seances) get().validateSeance(sid, {});
        for (const g of plan.soins) get().confirmSession(g.ids, g.horseIds, g.date);
        return plan.seances.length + plan.soins.length;
      },

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

      stopRecurringExpense: (rid, today = localToday()) =>
        set((s) => ({
          recurringExpenses: arreterRecurrentes(s.recurringExpenses ?? [], rid, today),
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

      stopRecurringRevenue: (rid, today = localToday()) =>
        set((s) => ({
          recurringRevenues: arreterRecurrentes(s.recurringRevenues ?? [], rid, today),
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

      // Pension, Cours, Refacturation, Frais fixes : l'app en dépend pour compter, elles ne se retirent pas.
      deleteRevenueCategory: (catId) =>
        set((s) => ({ revenueCategories: s.revenueCategories.filter((c) => c.id !== catId || !!categorieSysteme(c, "recette")) })),

      deleteExpenseCategory: (catId) =>
        set((s) => ({ expenseCategories: s.expenseCategories.filter((c) => c.id !== catId || !!categorieSysteme(c, "depense")) })),

      setPension: (horseId, amount, monthKey) =>
        set((s) => {
          const value = Math.max(0, Math.round(amount * 100) / 100);
          const rid = `rev-pension-${horseId}-${monthKey}`;
          return {
            horses: s.horses.map((h) => (h.id === horseId ? { ...h, pension: value } : h)),
            revenues: s.revenues.map((r) => (r.id === rid ? { ...r, amount: value } : r)),
          };
        }),

      setMonthlyCharge: (categoryId, label, amount, period, saisi) =>
        set((s) => {
          const start = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
          const value = Math.max(0, Math.round(amount * 100) / 100);
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
              ...(saisi ? { saisi } : {}),
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

      updatePerson: (pid, patch) =>
        set((s) => {
          const before = (s.people ?? []).find((p) => p.id === pid);
          const people = (s.people ?? []).map((p) => (p.id === pid ? { ...p, ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() || p.name } : {}) } : p));
          const to = patch.name?.trim();
          if (!before || !to || to === before.name) return { people };
          // Renommer : le nom suit sur ses chevaux, ses recettes et ses paiements.
          const r = renommerClient({ ...s, people: s.people ?? [] }, before.name, to);
          for (const h of r.horses) if (h.ownerName === to && s.horses.find((x) => x.id === h.id)?.ownerName !== to) enqueueMutation("update", "horses", { ...h });
          for (const x of r.revenues) if (x.payer === to && s.revenues.find((y) => y.id === x.id)?.payer !== to) enqueueMutation("update", "revenues", { ...x });
          return { ...r, people: r.people!.map((p) => (p.id === pid ? { ...p, ...patch, name: to } : p)) };
        }),

      setOwner: (horseId, name) => {
        const s = get();
        const c = changerProprio(s, horseId, name, localToday(), () => id("pers"));
        const hadPerson = new Set((s.people ?? []).map((p) => p.id));
        const prevPeople = s.people ?? [];
        const horse = c.horses.find((h) => h.id === horseId);
        if (horse && c.before !== c.owner) enqueueMutation("update", "horses", { ...horse });
        for (const t of c.touched) {
          const r = c.revenues.find((x) => x.id === t.id);
          if (r) enqueueMutation("update", "revenues", { ...r });
        }
        set({ horses: c.horses, revenues: c.revenues, people: c.people });
        return () =>
          set((cur) => {
            const back = new Map(c.touched.map((t) => [t.id, t.before]));
            const revenues = cur.revenues.map((r) => {
              if (!back.has(r.id)) return r;
              const next: Revenue = { ...r, payer: back.get(r.id) };
              if (!next.payer) delete next.payer;
              enqueueMutation("update", "revenues", { ...next });
              return next;
            });
            const horses = cur.horses.map((h) => {
              if (h.id !== horseId) return h;
              const next: Horse = { ...h, ownerName: c.before };
              if (!c.before) delete next.ownerName;
              enqueueMutation("update", "horses", { ...next });
              return next;
            });
            // La personne créée pour l'occasion repart, si rien d'autre ne la cite.
            const people = (cur.people ?? []).flatMap((p) => {
              if (!hadPerson.has(p.id)) return horses.some((h) => h.ownerName === p.name) ? [p] : [];
              const prev = prevPeople.find((x) => x.id === p.id)!;
              return [{ ...p, active: prev.active, role: prev.role }];
            });
            return { horses, revenues, people };
          });
      },

      deletePerson: (pid) =>
        set((s) => {
          const r = retirerClient(s, pid, localToday(), () => id("pers"));
          for (const h of r.horses) if (s.horses.find((x) => x.id === h.id)?.ownerName !== h.ownerName) enqueueMutation("update", "horses", { ...h });
          for (const x of r.revenues) if (s.revenues.find((y) => y.id === x.id)?.payer !== x.payer) enqueueMutation("update", "revenues", { ...x });
          return r;
        }),

      addPrestation: (p) => {
        const pid = id("prest");
        set((s) => ({ prestations: [...(s.prestations ?? []), { ...p, label: p.label.trim(), id: pid, active: true }] }));
        return pid;
      },
      updatePrestation: (pid, patch) => set((s) => ({ prestations: (s.prestations ?? []).map((p) => (p.id === pid ? { ...p, ...patch } : p)) })),
      removePrestation: (pid) => {
        const used = (get().seances ?? []).some((x) => x.prestationId === pid);
        if (used) {
          set((s) => ({ prestations: (s.prestations ?? []).map((p) => (p.id === pid ? { ...p, active: false } : p)) }));
          return "en_pause";
        }
        set((s) => ({ prestations: (s.prestations ?? []).filter((p) => p.id !== pid) }));
        return "supprimee";
      },

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
          // Sans propriétaire, personne ne doit cette recette : rien n'est créé.
          if (!horse?.ownerName?.trim()) return s;
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
                // Sans répartition figée : partagée entre les chevaux présents ce mois-là,
                // même ceux qui arrivent après (presence.ts, repartition).
                allocations: [],
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

      addPayment: (payer, month, amount, seanceId, how) => {
        const pid = id("pay");
        const amt = Math.round(amount * 100) / 100;
        const cheque = how?.method === "cheque" ? how.chequeNumber?.trim() : undefined;
        set((s) => ({
          payments: [
            ...(s.payments ?? []),
            { id: pid, payer, month, amount: amt, at: new Date().toISOString(), ...(seanceId ? { seanceId } : {}), ...(how?.method ? { method: how.method } : {}), ...(cheque ? { chequeNumber: cheque } : {}) },
          ],
        }));
        return pid;
      },

      setBilling: (patch) =>
        set((s) => {
          const b: BillingInfo = { ...(s.billing ?? {}), ...patch };
          if (patch.rates) b.rates = { ...(s.billing?.rates ?? {}), ...patch.rates };
          return { billing: b };
        }),

      issueInvoice: (contenu, today, stableName) => {
        let inv: Invoice | undefined;
        set((s) => {
          inv = emettre(s, contenu, today, stableName, id("inv"));
          return { invoices: [...(s.invoices ?? []), inv], invoiceSeq: { ...(s.invoiceSeq ?? {}), [String(inv.year)]: inv.seq } };
        });
        return inv!;
      },

      removePayment: (pid) => set((s) => ({ payments: (s.payments ?? []).filter((p) => p.id !== pid) })),

      addNote: (personId, text, at) => {
        const t = text.trim();
        if (!t) return;
        const day = at ?? localToday();
        set((s) => ({ people: (s.people ?? []).map((p) => (p.id === personId ? { ...p, notes: [{ id: id("note"), at: day, text: t }, ...(p.notes ?? [])] } : p)) }));
      },

      removePayments: (payer, month) => set((s) => ({ payments: (s.payments ?? []).filter((p) => !(p.payer === payer && p.month === month)) })),

      quitterSecours: (mode) => {
        if (mode === "repartir") {
          if (getSession()?.kind === "demo") get().resetToDemo();
          else get().startEmpty();
        }
        set({ secours: undefined });
      },

      resetToDemo: () => set({ ...buildDemoData(), autopilotDismissed: [], postesCommuns: POSTES_VERSION, pensionsAu: undefined }),

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
          holding: {},
          services: [],
          team: [],
          people: [],
          // Les cours de l'exemple, sans leurs prix : seul le gérant fixe les siens.
          prestations: (demo.prestations ?? []).map((p) => ({ ...p, price: 0 })),
          seances: [],
          taskLists: demo.taskLists,
          tasks: [],
          actions: [],
          payments: [],
          autopilotDismissed: [],
          postesCommuns: POSTES_VERSION,
          pensionsAu: undefined,
          revenueCategories: demo.revenueCategories,
          expenseCategories: demo.expenseCategories,
        });
      },
    }),
    {
      name: "be-stable-data",
      version: 5,
      // Un tiroir par compte, chiffré avec la clé du compte (lib/account/vault).
      storage: stockageSur,
      // v2 : séances, personnes, tâches d'équipe, actions, paiements. Une
      // version 1 repart de la démo complète pour avoir des exemples cohérents.
      // v3 : les chevaux partis reçoivent une date de départ (presence.ts) ; leur passé revient.
      // v4 : une écurie à soi perd les prix d'exemple de ses cours, jamais saisis ni employés.
      // v5 : chaque cheval reçoit ses séjours (arrivée, départ, provenance, destination) ;
      //      les catégories dont dépend l'autopilote (Pension, Cours…) retirées avant reviennent.
      migrate: (old, v) => {
        const n = nettoyer(old);
        if (n.problemes.length) abime = { problemes: n.problemes, copie: copieDe(old) };
        return migrerDonnees(n.data, v) as never;
      },
      // Un état abîmé ne casse plus les écrans : on garde ce qui se lit, et l'écran de secours le dit.
      merge: (persisted, current) => {
        if (persisted === undefined || persisted === null) return current;
        const brut = (persisted as Record<string, unknown>)[BRUT];
        if (typeof brut === "string") return { ...current, ...(vide() as Partial<DataState>), secours: { problemes: ["toutes les données"], copie: brut } };
        const n = nettoyer(persisted);
        const pb = abime ?? (n.problemes.length ? { problemes: n.problemes, copie: copieDe(persisted) } : undefined);
        abime = undefined;
        return { ...current, ...(n.data as Partial<DataState>), ...(pb ? { secours: pb } : {}) };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Un compte qui n'a encore rien sur cet appareil démarre vide, comme
        // l'écurie essayée sans compte ; la démo garde son écurie d'exemple.
        const kind = getSession()?.kind;
        if (wasFresh("be-stable-data") && (kind === "compte" || kind === "locale")) state.startEmpty();
        // Une démo vidée par l'ancien « Tout effacer » retrouve son écurie d'exemple.
        if (kind === "demo" && !useDataStore.getState().secours && useDataStore.getState().horses.length === 0) state.resetToDemo();
        // Une écurie déjà enregistrée reçoit une fois les postes ajoutés depuis
        // (emprunt, MSA…), sans rien perdre ; un poste retiré ensuite ne revient pas.
        const cur = useDataStore.getState();
        if ((cur.postesCommuns ?? 0) < POSTES_VERSION) useDataStore.setState({ expenseCategories: ajouterPostesManquants(cur.expenseCategories), postesCommuns: POSTES_VERSION });
        useDataStore.setState({ hydrated: true });
      },
    },
  ),
);
