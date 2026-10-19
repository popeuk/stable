"use client";

import dynamic from "next/dynamic";
import { useEffect, useSyncExternalStore } from "react";
import { brancherOnglet, ecouterOnglet, ongletEnPause } from "@/lib/onglet";

/** La feuille ne se charge que si l'onglet passe en pause. */
const OngletEnPause = dynamic(() => import("@/components/bs/onglet-en-pause").then((m) => m.OngletEnPause), { ssr: false });

/**
 * L'écran posé sur un onglet en pause (lib/onglet) : Be Stable est ouvert
 * ailleurs, cet onglet n'écrit plus rien. « Reprendre ici » recharge l'onglet
 * sur les données à jour. Posé une fois dans app/layout.tsx.
 */
export function UnSeulOnglet() {
  useEffect(() => brancherOnglet(), []);
  const enPause = useSyncExternalStore(ecouterOnglet, ongletEnPause, () => false);
  if (!enPause) return null;
  return <OngletEnPause />;
}
