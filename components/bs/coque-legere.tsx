"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUiStore } from "@/stores/ui-store";
import { useDesk } from "@/components/bs/desk-hook";

/**
 * Ce que la coque ne charge qu'au moment où il sert, pour que le téléphone
 * n'attende pas tout le bureau ni les grandes feuilles avant d'afficher son
 * écran. Les feuilles se téléchargent dès que la page est calme : le + s'ouvre
 * aussi vite qu'avant.
 */

const chargerNoter = () => import("@/components/bs/noter-sheet");
const chargerSeance = () => import("@/components/bs/seance-sheet");
const chargerTournee = () => import("@/components/bs/tournee");
const chargerBureau = () => import("@/components/bs/desk");

const NoterSheet = dynamic(() => chargerNoter().then((m) => m.NoterSheet), { ssr: false });
const SeanceSheet = dynamic(() => chargerSeance().then((m) => m.SeanceSheet), { ssr: false });
const Tournee = dynamic(() => chargerTournee().then((m) => m.Tournee), { ssr: false });
const Sidebar = dynamic(() => chargerBureau().then((m) => m.Sidebar), { ssr: false });
const Shortcuts = dynamic(() => chargerBureau().then((m) => m.Shortcuts), { ssr: false });
const CommandPalette = dynamic(() => chargerBureau().then((m) => m.CommandPalette), { ssr: false });
const ShortcutHelp = dynamic(() => chargerBureau().then((m) => m.ShortcutHelp), { ssr: false });

/** Après le premier affichage, quand le téléphone ne fait plus rien. */
function quandCalme(f: () => void) {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(f, { timeout: 4000 });
  else setTimeout(f, 2500);
}

export function FeuillesDifferees() {
  const noter = useUiStore((s) => s.noterOpen);
  const seance = useUiStore((s) => s.seanceId);
  useEffect(() => {
    const go = () =>
      quandCalme(() => {
        void chargerNoter();
        void chargerSeance();
      });
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
  }, []);
  return (
    <>
      {noter && <NoterSheet />}
      {seance && <SeanceSheet />}
    </>
  );
}

export function TourneeDifferee() {
  return <Tournee />;
}

/** La barre latérale, sur ordinateur seulement. */
export function BarreBureau() {
  const desk = useDesk();
  if (!desk) return null;
  return (
    <Suspense fallback={null}>
      <Sidebar />
    </Suspense>
  );
}

/**
 * Les raccourcis, la palette et l'aide des raccourcis : sur ordinateur, ou dès
 * qu'un clavier sert (une tablette avec clavier, un petit écran d'ordinateur).
 */
export function ClavierBureau() {
  const desk = useDesk();
  const [clavier, setClavier] = useState(false);
  const palette = useUiStore((s) => s.paletteOpen);
  const aide = useUiStore((s) => s.helpOpen);
  useEffect(() => {
    if (desk || clavier) return;
    const k = (e: KeyboardEvent) => {
      // Ctrl K ou ⌘ K avant le chargement : la palette s'ouvre quand même.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useUiStore.getState().openPalette();
      }
      setClavier(true);
    };
    window.addEventListener("keydown", k, { once: true });
    return () => window.removeEventListener("keydown", k);
  }, [desk, clavier]);
  const actif = desk || clavier;
  return (
    <>
      {actif && <Shortcuts />}
      {palette && <CommandPalette />}
      {aide && <ShortcutHelp />}
    </>
  );
}

/** Raccourci d'icône de l'app (manifeste) : « ?ajouter=seance » ouvre l'ajout. */
function AjouterDepuisIconeInner() {
  const params = useSearchParams();
  useEffect(() => {
    const m = params.get("ajouter");
    if (m === "seance" || m === "soin" || m === "tache" || m === "depense") useUiStore.getState().openNoter({ mode: m });
  }, [params]);
  return null;
}

export function AjouterDepuisIcone() {
  return (
    <Suspense fallback={null}>
      <AjouterDepuisIconeInner />
    </Suspense>
  );
}
