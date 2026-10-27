"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/account/api";
import { getSession } from "@/lib/account/session";
import { etatsBriques, essaiPossible, jourEssai, type AlerteId, type BriqueId, type EtatBrique, type EtatCompte } from "@/lib/briques";
import { OUVERTURE } from "@/lib/fonctions";
import { localToday } from "@/lib/utils/local-date";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * Les briques du compte, lues par la barre, l'en-tête, l'accueil et le + (lib/briques.ts).
 *
 * En préproduction seulement (NEXT_PUBLIC_PREPROD), on peut voir l'app après
 * l'ouverture sans rien construire : ?ouverture=1 l'allume sur cet appareil,
 * ?ouverture=0 l'éteint.
 */
const DRAPEAU = "bs-ouverture";

function ouvertureIci(): boolean {
  if (OUVERTURE) return true;
  if (!process.env.NEXT_PUBLIC_PREPROD || typeof window === "undefined") return false;
  try {
    const v = new URLSearchParams(window.location.search).get("ouverture");
    if (v === "1") localStorage.setItem(DRAPEAU, "1");
    if (v === "0") localStorage.removeItem(DRAPEAU);
    return localStorage.getItem(DRAPEAU) === "1";
  } catch {
    return false;
  }
}

export interface Briques {
  /** La session et l'ouverture sont lues (après le premier rendu) : avant, rien ne se décide. */
  pret: boolean;
  etat: Record<BriqueId, EtatBrique>;
  ouvert: boolean;
  /** Le jour de l'essai (1 à 30), ou null hors essai. */
  jourEssai: number | null;
  essaiPossible: boolean;
  commencerEssai: () => void;
  alertes: Partial<Record<AlerteId, string>>;
  basculerAlerte: (id: AlerteId) => void;
}

export function useBriques(): Briques {
  const essaiDebut = useSettingsStore((s) => s.essaiDebut);
  const alertes = useSettingsStore((s) => s.alertes);
  // Lu après le premier rendu : la session et le drapeau vivent dans le navigateur.
  const [ici, setIci] = useState<{ kind: EtatCompte["kind"]; ouvert: boolean; pret: boolean }>({ kind: undefined, ouvert: OUVERTURE, pret: false });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIci({ kind: getSession()?.kind, ouvert: ouvertureIci(), pret: true });
  }, []);
  return useMemo(() => {
    const aujourdhui = localToday();
    const compte: EtatCompte = { kind: ici.kind, ouvert: ici.ouvert, essaiDebut, aujourdhui };
    const etat = etatsBriques(compte);
    return {
      pret: ici.pret,
      etat,
      ouvert: ici.ouvert,
      jourEssai: etat.argent === "essai" && essaiDebut ? jourEssai(essaiDebut, aujourdhui) : null,
      essaiPossible: essaiPossible(compte),
      commencerEssai: () => useSettingsStore.getState().commencerEssai(localToday()),
      alertes,
      basculerAlerte: (id) => {
        const actif = useSettingsStore.getState().basculerAlerte(id, localToday());
        // Le site garde la liste pour prévenir à l'ouverture ; sans réponse, l'alerte reste sur l'appareil.
        if (getSession()?.kind === "compte") void api.alerte(id, actif).catch(() => undefined);
      },
    };
  }, [ici, essaiDebut, alertes]);
}
