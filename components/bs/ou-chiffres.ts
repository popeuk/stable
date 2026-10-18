"use client";

import { useEffect, useState } from "react";
import { getSession } from "@/lib/account/session";
import { cetAppareil, ouSontLesChiffres } from "@/lib/appareil";

/**
 * Où sont les chiffres, pour les textes qui le disent : « ce téléphone » ou
 * « cet ordinateur », et s'il y a un compte (la copie en ligne). Lu après le
 * montage (l'export statique ne connaît ni l'appareil ni la session).
 */
export function useOuChiffres(): { cet: string; compte: boolean; ou: string } {
  const [v, setV] = useState({ cet: "ce téléphone", compte: false, ou: "sur ce téléphone" });
  useEffect(() => {
    const compte = getSession()?.kind === "compte";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setV({ cet: cetAppareil(), compte, ou: ouSontLesChiffres(compte) });
  }, []);
  return v;
}
