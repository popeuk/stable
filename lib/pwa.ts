"use client";

import { useSyncExternalStore } from "react";

/**
 * L'installation de l'app, sur téléphone ou ordinateur. Chrome et Edge
 * proposent un bouton (l'événement beforeinstallprompt, gardé ici dès le
 * chargement) ; Safari s'installe à la main, on explique comment.
 */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallEvent | null = null;
let installed = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function captureInstall() {
  if (typeof window === "undefined") return;
  const early = (window as Window & { __bsInstall?: InstallEvent }).__bsInstall;
  if (early && !deferred) {
    deferred = early;
    emit();
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

export type InstallWay = "bouton" | "ios" | "safari-mac" | "autre";

function standalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function way(): InstallWay {
  if (deferred) return "bouton";
  if (typeof navigator === "undefined") return "autre";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return "safari-mac";
  return "autre";
}

type Snap = { way: InstallWay; installed: boolean };
let last: Snap = { way: "autre", installed: false };
function snapshot(): Snap {
  const next = { way: way(), installed: installed || standalone() };
  if (next.way !== last.way || next.installed !== last.installed) last = next;
  return last;
}
const server: Snap = { way: "autre", installed: false };

export function useInstall() {
  const s = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    snapshot,
    () => server,
  );
  return {
    ...s,
    async prompt() {
      if (!deferred) return false;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      emit();
      return outcome === "accepted";
    },
  };
}

/** Les mots pour installer, selon l'appareil. */
export const INSTALL_HOWTO: Record<Exclude<InstallWay, "bouton">, string[]> = {
  ios: ["Ouvre l’app dans Safari.", "Touche le bouton Partager (le carré avec une flèche).", "Choisis « Sur l’écran d’accueil », puis « Ajouter »."],
  "safari-mac": ["Dans Safari, menu Fichier.", "Choisis « Ajouter au Dock ».", "Be Stable s’ouvre ensuite comme une app, depuis le Dock ou le Launchpad."],
  autre: [
    "Ouvre l’app dans Chrome ou Edge, sur ordinateur ou sur Android.",
    "Clique sur l’icône d’installation à droite de la barre d’adresse (un écran avec une flèche), ou menu ⋮ puis « Installer Be Stable ».",
    "Sur Android, menu ⋮ puis « Ajouter à l’écran d’accueil ».",
  ],
};
