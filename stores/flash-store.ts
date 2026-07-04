"use client";

import { create } from "zustand";

/**
 * One-shot feedback after a save: the entry the user just made, shown as an
 * animated banner on the home so the cause (saisie) → effect (jauges qui
 * bougent) loop is visible. In-memory only — a flash never survives a reload.
 */
export interface Flash {
  kind: "revenue" | "expense";
  amount: number;
  label: string;
}

interface FlashState {
  flash: Flash | null;
  setFlash: (f: Flash) => void;
  clearFlash: () => void;
}

export const useFlashStore = create<FlashState>()((set) => ({
  flash: null,
  setFlash: (f) => set({ flash: f }),
  clearFlash: () => set({ flash: null }),
}));
