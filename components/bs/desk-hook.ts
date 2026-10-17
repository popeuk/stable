"use client";

import { useSyncExternalStore } from "react";

/**
 * L'écran large, sans le reste du bureau : les écrans demandent seulement
 * « suis-je sur ordinateur ? ». La barre latérale, la palette et les
 * raccourcis (`desk.tsx`) ne se chargent que sur ordinateur.
 */
export const DESK = "(min-width: 1024px)";

/** Vrai sur un écran d'ordinateur (1024 px et plus). */
export function useDesk() {
  return useSyncExternalStore(
    (f) => {
      const m = window.matchMedia(DESK);
      m.addEventListener("change", f);
      return () => m.removeEventListener("change", f);
    },
    () => window.matchMedia(DESK).matches,
    () => false,
  );
}

export const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const modKey = () => (isMac() ? "⌘" : "Ctrl");
