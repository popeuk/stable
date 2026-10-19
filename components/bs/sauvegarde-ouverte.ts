"use client";

import { useEffect } from "react";
import { cetAppareil } from "@/lib/appareil";
import { useUiStore } from "@/stores/ui-store";

/** Posée quand une sauvegarde vient d'être ouverte (components/bs/reprendre-sauvegarde.tsx). */
export const MARQUE = "bs-sauvegarde-ouverte";

/** À l'accueil, juste après : la sauvegarde est ouverte sur cet appareil, le compte la gardera. */
export function useSauvegardeOuverte() {
  const say = useUiStore((s) => s.say);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(MARQUE) !== "1") return;
      sessionStorage.removeItem(MARQUE);
    } catch {
      return;
    }
    say(`Ta sauvegarde est ouverte, sur ${cetAppareil()} seulement. Crée ton compte pour la garder.`);
  }, [say]);
}
