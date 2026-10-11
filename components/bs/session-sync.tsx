"use client";

import { useEffect } from "react";
import { api, ApiError } from "@/lib/account/api";
import { getSession, leave, updateAccount } from "@/lib/account/session";

/**
 * À l'ouverture de l'app, la session se met à jour en silence : fiche
 * validée entre-temps, prénom changé sur le site. Si le compte a été fermé
 * ailleurs (mot de passe changé, déconnexion de tous les appareils), retour
 * à la connexion : les données restent chiffrées sur l'appareil. Hors ligne,
 * rien ne bouge.
 */
export function SessionSync() {
  useEffect(() => {
    const s = getSession();
    if (s?.kind !== "compte") return;
    api.moi().then(
      (r) => updateAccount({ listing: r.listing, prenom: r.user.prenom, nom: r.user.nom, telephone: r.user.telephone }),
      (e) => {
        if (e instanceof ApiError && e.code === "session_expiree") leave("/compte/connexion");
      },
    );
  }, []);
  return null;
}
