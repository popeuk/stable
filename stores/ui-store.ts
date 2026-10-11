"use client";

import { create } from "zustand";
import type { CareKind } from "@/lib/domain/care";

/**
 * L'état d'interface partagé : la feuille « Noter » (ouverte depuis le +,
 * un ticket ou une échéance), le message du bas, et la dernière ligne
 * ajoutée (surlignée sur le ticket du cheval).
 */
export type AddMode = "seance" | "soin" | "tache" | "depense";
export interface NoterPrefill {
  mode?: AddMode;
  /** Pour une séance : l'heure touchée dans les créneaux. */
  start?: string;
  horseIds?: string[];
  kind?: NoteKindId;
  amount?: number;
  date?: string;
  /** Pour une séance : la prestation choisie d'avance. */
  prestationId?: string;
}

export type NoteKindId =
  | CareKind
  | "recette"
  | "depense"
  | "commune";

interface Toast {
  id: number;
  html: string;
  undo?: () => void;
}

interface UiState {
  noterOpen: boolean;
  prefill: NoterPrefill;
  toast: Toast | null;
  lastLine: { horseId: string; sourceId: string } | null;
  /** La séance ouverte (fiche, présence, modification). */
  seanceId: string | null;
  seanceView: "fiche" | "presence" | "modifier";
  openSeance: (id: string, view?: "fiche" | "presence" | "modifier") => void;
  closeSeance: () => void;
  openNoter: (p?: NoterPrefill) => void;
  closeNoter: () => void;
  say: (html: string, undo?: () => void) => void;
  dismiss: () => void;
  markLine: (horseId: string, sourceId: string) => void;
  /** Ordinateur : la palette (Ctrl K) et l'aide des raccourcis (?). */
  paletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  helpOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useUiStore = create<UiState>((set) => ({
  noterOpen: false,
  prefill: {},
  toast: null,
  lastLine: null,
  seanceId: null,
  seanceView: "fiche",
  openSeance: (id, view = "fiche") => set({ seanceId: id, seanceView: view }),
  closeSeance: () => set({ seanceId: null }),
  openNoter: (p = {}) => set({ noterOpen: true, prefill: p }),
  closeNoter: () => set({ noterOpen: false }),
  say: (html, undo) => {
    const id = Date.now();
    set({ toast: { id, html, undo } });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => set((s) => (s.toast?.id === id ? { toast: null } : s)), undo ? 6000 : 4000);
  },
  dismiss: () => set({ toast: null }),
  markLine: (horseId, sourceId) => set({ lastLine: { horseId, sourceId } }),
  paletteOpen: false,
  openPalette: () => set({ paletteOpen: true, helpOpen: false }),
  closePalette: () => set({ paletteOpen: false }),
  helpOpen: false,
  openHelp: () => set({ helpOpen: true, paletteOpen: false }),
  closeHelp: () => set({ helpOpen: false }),
}));
