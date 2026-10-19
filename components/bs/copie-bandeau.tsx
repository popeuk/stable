"use client";

import { useSyncExternalStore } from "react";
import { ecouterRefus, refusCopie } from "@/lib/account/nuage";
import { texteRefus } from "@/lib/account/etat-copie";
import { exporterCeQuiReste } from "@/components/bs/secours";

/**
 * Le bandeau de la copie en ligne refusée par le serveur (lib/account/nuage :
 * refusCopie). Trop grosse ou mal formée, elle ne partira plus d'elle-même :
 * on le dit tout de suite, et on propose une sauvegarde. Il reste tant que le
 * refus tient. À poser une fois dans app/(app)/layout.tsx.
 */
export function CopieBandeau() {
  const refus = useSyncExternalStore(ecouterRefus, refusCopie, () => null);
  const texte = texteRefus(refus);
  if (!texte) return null;
  return (
    <div className="es-keep bs-place fort" role="alert">
      <span>
        <b>{texte}</b>
      </span>
      <button type="button" className="btn" onClick={() => exporterCeQuiReste()}>
        Sauvegarder
      </button>
    </div>
  );
}
