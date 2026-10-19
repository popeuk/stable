"use client";

import { useEffect } from "react";
import { ecouterChangements, envoyer, lireDrapeau, synchroniser } from "@/lib/account/nuage";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { localToday } from "@/lib/utils/local-date";

/** Les factures faites sans réseau reçoivent leur numéro dès que le serveur répond (question 18, réponse A). */
async function numeroterLesProvisoires() {
  const st = useDataStore.getState();
  if (!st.hydrated || !(st.invoices ?? []).some((i) => i.provisoire)) return;
  try {
    const n = await st.numeroterEnAttente(localToday());
    if (n.length) useUiStore.getState().say(n.length > 1 ? `Le réseau est revenu : <strong>${n.length} factures</strong> ont reçu leur numéro.` : `Le réseau est revenu : la facture a reçu le n° <strong>${n[0].number}</strong>.`);
  } catch {
    // Pas pu l'enregistrer (téléphone plein) : elle reste provisoire, le bandeau de place le dit.
  }
}

/**
 * La copie en ligne (lib/account/nuage), branchée sur l'app : on lit le
 * serveur à l'ouverture et à chaque retour sur l'app, on envoie ce qui
 * attend dès que le réseau revient. Si un autre appareil a écrit, les
 * données à l’écran sont relues, et les factures faites sans réseau
 * reçoivent leur numéro. Allumée pour tous ; ?nuage=0 l’éteint sur un appareil.
 */
export function NuageSync() {
  useEffect(() => {
    lireDrapeau(window.location.search);
    const off = ecouterChangements((noms) => {
      if (noms.has("be-stable-data")) void useDataStore.persist.rehydrate();
      if (noms.has("be-stable-settings")) void useSettingsStore.persist.rehydrate();
    });
    const tirer = () => {
      if (document.visibilityState === "visible") void synchroniser().then(numeroterLesProvisoires);
    };
    const pousser = () => void envoyer().then(numeroterLesProvisoires);
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
