"use client";

import { useEffect } from "react";
import { getSession } from "@/lib/account/session";
import { canalDeLEcurie, ecouterChangements, envoyer, lireDrapeau, signalerMorceauManquant, synchroniser } from "@/lib/account/nuage";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { localToday } from "@/lib/utils/local-date";

/** Les factures faites sans réseau reçoivent leur numéro dès que le serveur répond (question 18, réponse A). */
async function numeroterLesProvisoires() {
  const st = useDataStore.getState();
  if (!st.hydrated || !(st.invoices ?? []).some((i) => i.provisoire)) return;
  try {
    const { numerotees: n, retirees } = await st.numeroterEnAttente(localToday());
    const { messageRetiree } = await import("@/lib/domain/numeros");
    const dit = [
      ...(n.length ? [n.length > 1 ? `Le réseau est revenu : <strong>${n.length} factures</strong> ont reçu leur numéro.` : `Le réseau est revenu : la facture a reçu le n° <strong>${n[0].number}</strong>.`] : []),
      ...retirees.map(messageRetiree),
    ];
    if (dit.length) useUiStore.getState().say(dit.join(" "));
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
 *
 * Après chaque lecture, l'app écoute le canal de l'écurie (lib/account/canal) :
 * quand un membre de l'équipe vient d'écrire, elle relit en une seconde. Les
 * relectures venues du canal sont freinées (une à la fois, une en attente,
 * pas plus d'une toutes les 2 s). La relecture toutes les deux minutes et au
 * retour sur l'app reste, au cas où le canal tombe. L'écoute (lib/account/canal)
 * ne se charge qu'une fois un canal reçu : elle n'est pas dans le paquet de l'Accueil.
 */
export function NuageSync() {
  useEffect(() => {
    lireDrapeau(window.location.search);
    const off = ecouterChangements((noms) => {
      if (noms.has("be-stable-data")) void useDataStore.persist.rehydrate();
      if (noms.has("be-stable-settings")) void useSettingsStore.persist.rehydrate();
    });
    const relire = () => synchroniser().then(numeroterLesProvisoires);
    let fini = false;
    let ecoute: { mod: typeof import("@/lib/account/canal"); frein: { demander(): void; arreter(): void } } | null = null;
    // Ouvre, change ou ferme l'écoute selon le canal de la session (aucun sans copie en ligne ou sur un téléphone trop ancien).
    const suivreCanal = () => {
      if (!canalDeLEcurie() && !ecoute) return;
      void import("@/lib/account/canal")
        .then((mod) => {
          if (fini) return;
          // Une lecture en cours peut ne pas avoir la version annoncée : on l'attend, puis on relit une fois de plus.
          ecoute ??= { mod, frein: mod.freiner(() => synchroniser(true).then(numeroterLesProvisoires), 2000) };
          const { frein } = ecoute;
          const demander = () => frein.demander();
          // Un message, ou le retour de l'abonnement après une coupure (les messages d'entre-temps sont perdus).
          mod.brancherCanal(canalDeLEcurie(), demander, undefined, demander);
        })
        // L'écoute elle-même n'a pas pu se charger : le navigateur ne la retentera pas, on propose de recharger.
        .catch(() => signalerMorceauManquant());
    };
    const tirer = () => {
      if (document.visibilityState === "visible") void relire().finally(suivreCanal);
      else suivreCanal();
    };
    // Une autre fenêtre a fermé ou changé la session : l'écoute suit.
    const surStockage = (e: StorageEvent) => {
      if (e.key === null || e.key === "be-stable-session") suivreCanal();
    };
    const pousser = () => void envoyer().then(numeroterLesProvisoires);
    tirer();
    // En équipe, les autres écrivent aussi : on relit toutes les deux minutes tant que l'app est à l'écran.
    const s = getSession();
    const equipe = s?.kind === "compte" && (!!s.espace || !!s.avecEquipe);
    const t = equipe ? setInterval(tirer, 120_000) : null;
    document.addEventListener("visibilitychange", tirer);
    window.addEventListener("online", pousser);
    window.addEventListener("storage", surStockage);
    return () => {
      fini = true;
      ecoute?.frein.arreter();
      ecoute?.mod.brancherCanal(null, () => {});
      window.removeEventListener("storage", surStockage);
      off();
      if (t) clearInterval(t);
      document.removeEventListener("visibilitychange", tirer);
      window.removeEventListener("online", pousser);
    };
  }, []);
  return null;
}
