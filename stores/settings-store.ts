"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AlerteId } from "@/lib/briques";
import { vault, wasFresh } from "@/lib/account/vault";
import { getSession } from "@/lib/account/session";

export interface NotificationPrefs {
  weeklyInsight: boolean;
  monthlyAudit: boolean;
  horseAlerts: boolean;
}

export type ObstacleId = "chevaux" | "tarifs" | "factures" | "journee" | "ticket" | "seuil";
export const OBSTACLES: ObstacleId[] = ["chevaux", "tarifs", "factures", "journee", "ticket", "seuil"];
const NO_OBSTACLE: Record<ObstacleId, boolean> = { chevaux: false, tarifs: false, factures: false, journee: false, ticket: false, seuil: false };
const ALL_OBSTACLES: Record<ObstacleId, boolean> = { chevaux: true, tarifs: true, factures: true, journee: true, ticket: true, seuil: true };

/** L'objectif de l'écurie d'exemple : la démo montre à quoi sert un objectif. */
export const DEMO_OBJECTIVE = 1000;
/** Les boxes de l'écurie d'exemple (9 chevaux, 12 boxes). */
export const DEMO_CAPACITY = 12;

/** Le nombre de boxes est-il connu ? (0 = jamais donné) */
export const capaciteConnue = (capacity: number) => capacity > 0;

/** Pas d'objectif posé (0) : l'interface ne parle alors ni de manque ni de pourcentage. */
export const hasObjective = (objective: number) => objective > 0;

/**
 * Les réglages à poser à l'ouverture d'un tiroir, selon la session. La démo
 * est une écurie déjà installée : son parcours est fini, elle s'ouvre sur
 * l'accueil des Trois Pommiers, jamais sur « Mes premiers pas ». Un compte
 * ou une écurie essayée sans compte, ouverts pour la première fois, partent
 * de zéro, sans objectif imposé.
 */
export function settingsAtOpen(kind: "compte" | "demo" | "locale" | undefined, fresh: boolean, p: { stableName?: string; prenom?: string } = {}): Partial<SettingsState> | null {
  if (kind === "demo")
    return {
      parcours: { ...ALL_OBSTACLES },
      arrived: true,
      onboarded: true,
      ...(fresh ? { objective: DEMO_OBJECTIVE, capacity: DEMO_CAPACITY, stableName: "Les Trois Pommiers", gerant: "Claire" } : {}),
    };
  if (!fresh) return null;
  if (kind === "compte") return { stableName: p.stableName || "Mon écurie", gerant: p.prenom || "", parcours: { ...NO_OBSTACLE }, arrived: false, objective: 0 };
  if (kind === "locale") return { stableName: "Mon écurie", gerant: "", parcours: { ...NO_OBSTACLE }, arrived: false, objective: 0 };
  return null;
}

interface SettingsState {
  notifications: NotificationPrefs;
  /**
   * Le nombre de boxes de l'écurie, tel que le gérant l'a donné. 0 = pas
   * encore donné : aucune estimation de boxes vides ne s'affiche tant qu'on
   * ne le connaît pas (rien n'est promis sur une donnée inventée).
   */
  capacity: number;
  /** Has the user seen the intro onboarding? */
  onboarded: boolean;
  /** Le parcours de démarrage : six obstacles, gagnés une fois pour toutes. */
  parcours: Record<ObstacleId, boolean>;
  /** Le flot « Écurie prête » a été montré. */
  arrived: boolean;
  /** Le parcours de démarrage est remis à plus tard : l'app s'ouvre quand même. */
  parcoursPlusTard: boolean;
  /** Les aides « Comment ça marche ici » déjà lues, écran par écran. */
  aidesVues: string[];
  voirAide: (id: string) => void;
  revoirAides: () => void;
  remettreParcours: () => void;
  stableName: string;
  gerant: string;
  /** L'heure du rappel du matin (« 7:45 »). */
  reminder: string;
  /** Un rappel le soir s'il reste quelque chose. */
  evening: boolean;
  /** L'objectif du mois : ce que le gérant veut se verser (€/mois). */
  objective: number;
  setObjective: (n: number) => void;
  passObstacle: (id: ObstacleId) => boolean;
  setArrived: () => void;
  setReminder: (t: string) => void;
  toggleEvening: () => void;
  setIdentity: (p: { stableName?: string; gerant?: string }) => void;
  resetParcours: () => void;
  toggle: (key: keyof NotificationPrefs) => void;
  setCapacity: (n: number) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  /** Le jour où le gérant a commencé l'essai de Mon argent (AAAA-MM-JJ), une seule fois (lib/briques.ts). */
  essaiDebut: string | null;
  commencerEssai: (aujourdhui: string) => void;
  /** Les alertes « Me prévenir à l'ouverture », avec le jour de l'inscription. */
  alertes: Partial<Record<AlerteId, string>>;
  basculerAlerte: (id: AlerteId, aujourdhui: string) => boolean;
  /** Les demandes de cavaliers auxquelles le gérant a répondu depuis l'app (le site ne le sait pas encore). */
  repondues: number[];
  marquerRepondue: (id: number, oui: boolean) => void;
}

/** Granular, opt-in notification preferences (spec 1.3 / 9.4) + stable config. */
/** La version des réglages (persist, et le fichier de sauvegarde). */
export const VERSION_REGLAGES = 7;

/** Les réglages d'une version d'avant, mis à la version d'aujourd'hui (au chargement et à la reprise d'une sauvegarde). */
export function migrerReglages(old: unknown, v: number): Record<string, unknown> {
  const { openRouterKey: _cle, ...reste } = (old ?? {}) as { openRouterKey?: string };
  void _cle;
  const o = { objective: 0, capacity: 0, ...reste } as { capacity: number };
  const capacity = v < 6 && o.capacity === 12 && getSession()?.kind !== "demo" ? 0 : o.capacity;
  return { ...o, capacity, ...(v < 4 ? { parcours: { ...NO_OBSTACLE }, arrived: false } : {}) };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      notifications: {
        weeklyInsight: true,
        monthlyAudit: true,
        horseAlerts: true,
      },
      capacity: 0,
      onboarded: false,
      parcours: { ...NO_OBSTACLE },
      arrived: false,
      parcoursPlusTard: false,
      aidesVues: [],
      voirAide: (id) => set((s) => (s.aidesVues.includes(id) ? s : { aidesVues: [...s.aidesVues, id] })),
      revoirAides: () => set({ aidesVues: [] }),
      remettreParcours: () => set({ parcoursPlusTard: true }),
      stableName: "Les Trois Pommiers",
      gerant: "Claire",
      reminder: "7:45",
      evening: true,
      // Pas d'objectif tant que le gérant ne l'a pas posé (0 = « pas d'objectif »).
      objective: 0,
      setObjective: (n) => set({ objective: Math.max(0, Math.round(n)) }),
      passObstacle: (id) => {
        if (get().parcours[id]) return false;
        set((s) => ({ parcours: { ...s.parcours, [id]: true } }));
        return true;
      },
      setArrived: () => set({ arrived: true }),
      setReminder: (t) => set({ reminder: t }),
      toggleEvening: () => set((s) => ({ evening: !s.evening })),
      setIdentity: (p) => set((s) => ({ stableName: p.stableName?.trim() || s.stableName, gerant: p.gerant?.trim() || s.gerant })),
      resetParcours: () => set({ parcours: { ...NO_OBSTACLE }, arrived: false, onboarded: false }),
      toggle: (key) =>
        set((s) => ({
          notifications: { ...s.notifications, [key]: !s.notifications[key] },
        })),
      setCapacity: (n) => set({ capacity: Math.max(1, Math.min(60, Math.round(n))) }),
      completeOnboarding: () => set({ onboarded: true }),
      resetOnboarding: () => set({ onboarded: false }),
      essaiDebut: null,
      commencerEssai: (aujourdhui) => set((s) => (s.essaiDebut ? s : { essaiDebut: aujourdhui })),
      alertes: {},
      repondues: [],
      marquerRepondue: (id, oui) => set((s) => ({ repondues: oui ? [...s.repondues.filter((x) => x !== id), id] : s.repondues.filter((x) => x !== id) })),
      basculerAlerte: (id, aujourdhui) => {
        const avant = get().alertes;
        const actif = !avant[id];
        const alertes = { ...avant };
        if (actif) alertes[id] = aujourdhui;
        else delete alertes[id];
        set({ alertes });
        return actif;
      },
    }),
    {
      name: "be-stable-settings",
      version: VERSION_REGLAGES,
      storage: createJSONStorage(() => vault),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const s = getSession();
        // Nouveau compte : l'écurie porte le nom de sa fiche, le gérant son prénom.
        // L'écurie essayée sans compte : pas encore de nom, pas de prénom.
        // La démo : une écurie installée, son parcours est fini.
        const patch = settingsAtOpen(s?.kind, wasFresh("be-stable-settings"), s?.kind === "compte" ? { stableName: s.listing?.title, prenom: s.prenom } : {});
        if (patch) useSettingsStore.setState(patch);
      },
      // v4 : le parcours de démarrage arrive ; les anciens réglages sont gardés.
      // v6 : les 12 boxes d'office n'étaient jamais demandés : hors démo, ils redeviennent « pas encore donné ».
      // v7 : la clé OpenRouter n'est plus lue nulle part (l'interprète de la saisie est local) ; si elle avait été saisie, elle quitte l'appareil.
      migrate: (old, v) => migrerReglages(old, v) as never,
    },
  ),
);
