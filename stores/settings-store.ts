"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
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

interface SettingsState {
  notifications: NotificationPrefs;
  /** Number of stalls the stable can host — drives occupancy advice. */
  capacity: number;
  /** Has the user seen the intro onboarding? */
  onboarded: boolean;
  /**
   * Clé OpenRouter de l'UTILISATEUR (BYOK) pour l'assistant vocal. Stockée
   * uniquement sur l'appareil, jamais dans le code ni le dépôt. Vide =
   * interpréteur local seul.
   */
  openRouterKey: string;
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
  setOpenRouterKey: (k: string) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

/** Granular, opt-in notification preferences (spec 1.3 / 9.4) + stable config. */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      notifications: {
        weeklyInsight: true,
        monthlyAudit: true,
        horseAlerts: true,
      },
      capacity: 12,
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
      objective: 1000,
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
      openRouterKey: "",
      setOpenRouterKey: (k) => set({ openRouterKey: k.trim() }),
      toggle: (key) =>
        set((s) => ({
          notifications: { ...s.notifications, [key]: !s.notifications[key] },
        })),
      setCapacity: (n) => set({ capacity: Math.max(1, Math.min(60, Math.round(n))) }),
      completeOnboarding: () => set({ onboarded: true }),
      resetOnboarding: () => set({ onboarded: false }),
    }),
    {
      name: "be-stable-settings",
      version: 5,
      storage: createJSONStorage(() => vault),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const s = getSession();
        // Nouveau compte : l'écurie porte le nom de sa fiche, le gérant son prénom.
        if (wasFresh("be-stable-settings") && s?.kind === "compte")
          useSettingsStore.setState({
            stableName: s.listing?.title || "Mon écurie",
            gerant: s.prenom || "",
            parcours: { ...NO_OBSTACLE },
            arrived: false,
          });
      },
      // v4 : le parcours de démarrage arrive ; les anciens réglages sont gardés.
      migrate: (old, v) => ({ objective: 1000, ...(old as object), ...(v < 4 ? { parcours: { ...NO_OBSTACLE }, arrived: false } : {}) }) as never,
    },
  ),
);
