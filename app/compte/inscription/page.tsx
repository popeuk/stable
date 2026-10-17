"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Rejoindre } from "@/components/bs/rejoindre";

/**
 * Lien direct vers une fiche (depuis mon-ecurie.fr : « Créer mon accès Be
 * Stable ») ou vers l'ajout d'une écurie : le même parcours, à la bonne étape.
 * ?retrouver=1 : depuis l'app (/ma-fiche), « Retrouver ma fiche mon-ecurie.fr »,
 * directement à la recherche de l'écurie. ?depuis=ecurie : venu de Mon écurie,
 * le retour de la première étape y ramène.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Inscription />
    </Suspense>
  );
}

function Inscription() {
  const q = useSearchParams();
  return (
    <div className="carnet">
      <Rejoindre ficheId={Number(q.get("fiche")) || 0} creer={!!q.get("creer")} retrouver={!!q.get("retrouver")} depuis={q.get("depuis")} />
    </div>
  );
}
