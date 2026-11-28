"use client";

import { useSyncExternalStore } from "react";
import { ecouterRefus, morceauManquant, refusCopie } from "@/lib/account/nuage";
import { TEXTE_RECHARGER, texteRefus } from "@/lib/account/etat-copie";
import { exporterSauvegarde } from "@/components/bs/secours";
import { donneesPlusRecentes, ecouterVersion } from "@/lib/version-donnees";

/**
 * Le bandeau de la copie en ligne refusée par le serveur (lib/account/nuage :
 * refusCopie). Trop grosse ou mal formée, elle ne partira plus d'elle-même :
 * on le dit tout de suite, et on propose une sauvegarde. Il reste tant que le
 * refus tient. À poser une fois dans app/(app)/layout.tsx.
 */
export function CopieBandeau() {
  const refus = useSyncExternalStore(ecouterRefus, refusCopie, () => null);
  // Un morceau de l'app ne s'est pas chargé : la copie ne repartira qu'après un rechargement.
  const recharger = useSyncExternalStore(ecouterRefus, morceauManquant, () => false);
  if (recharger)
    return (
      <div className="es-keep bs-place fort" role="alert">
        <span>
          <b>{TEXTE_RECHARGER}</b>
        </span>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          Recharger
        </button>
      </div>
    );
  const texte = texteRefus(refus);
  if (!texte) return null;
  return (
    <div className="es-keep bs-place fort" role="alert">
      <span>
        <b>{texte}</b>
      </span>
      <button type="button" className="btn" onClick={() => exporterSauvegarde()}>
        Faire une sauvegarde
      </button>
    </div>
  );
}

/**
 * Le bandeau des données plus récentes que l'app (lib/version-donnees) :
 * l'app n'écrit plus rien par-dessus, il faut la recharger pour avoir la
 * nouvelle version.
 */
export function VersionBandeau() {
  const plus = useSyncExternalStore(ecouterVersion, donneesPlusRecentes, () => false);
  if (!plus) return null;
  return (
    <div className="es-keep bs-place fort" role="alert">
      <span>
        <b>Ton écurie a été ouverte avec une version plus récente de Be Stable. Recharge l’app : rien n’est enregistré ici en attendant.</b>
      </span>
      <button type="button" className="btn" onClick={() => window.location.reload()}>
        Recharger
      </button>
    </div>
  );
}
