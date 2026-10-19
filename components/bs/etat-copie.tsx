"use client";

import { useEffect, useState } from "react";
import { etatNuage } from "@/lib/account/nuage";
import { texteCopie } from "@/lib/account/etat-copie";
import { cetAppareil } from "@/lib/appareil";

/** Dans Mon compte : où en est la copie en ligne (« à jour à 10 h 42 », « 3 changements attendent le réseau »). */
export function EtatCopie() {
  const [t, setT] = useState<string | null>(null);
  const [refuse, setRefuse] = useState(false);
  useEffect(() => {
    const lire = () => {
      const e = etatNuage();
      setT(texteCopie(e));
      setRefuse(!!e.refus);
    };
    lire();
    const minuteur = setInterval(lire, 5000);
    window.addEventListener("online", lire);
    window.addEventListener("offline", lire);
    return () => {
      clearInterval(minuteur);
      window.removeEventListener("online", lire);
      window.removeEventListener("offline", lire);
    };
  }, []);
  if (!t) return null;
  return (
    <div className="li np" role="status">
      <span>
        <b>{t}</b>
        <small>{refuse ? `tes chiffres restent sur ${cetAppareil()} ; une sauvegarde les garde dans un fichier` : "ton téléphone et ton ordinateur la retrouvent avec ton e-mail"}</small>
      </span>
      <span />
    </div>
  );
}
