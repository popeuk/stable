"use client";

import { useEffect } from "react";
import { ecouterChangements, envoyer, lireDrapeau, synchroniser } from "@/lib/account/nuage";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * La copie en ligne (lib/account/nuage), branchée sur l'app : on lit le
 * serveur à l'ouverture et à chaque retour sur l'app, on envoie ce qui
 * attend dès que le réseau revient. Si un autre appareil a écrit, les
 * données à l’écran sont relues. Allumée pour tous ; ?nuage=0 l’éteint sur un appareil.
 */
export function NuageSync() {
  useEffect(() => {
    lireDrapeau(window.location.search);
    const off = ecouterChangements((noms) => {
      if (noms.has("be-stable-data")) void useDataStore.persist.rehydrate();
      if (noms.has("be-stable-settings")) void useSettingsStore.persist.rehydrate();
    });
    const tirer = () => {
      if (document.visibilityState === "visible") void synchroniser();
    };
    const pousser = () => void envoyer();
    tirer();
    document.addEventListener("visibilitychange", tirer);
    window.addEventListener("online", pousser);
    return () => {
      off();
      document.removeEventListener("visibilitychange", tirer);
      window.removeEventListener("online", pousser);
    };
  }, []);
  return null;
}
