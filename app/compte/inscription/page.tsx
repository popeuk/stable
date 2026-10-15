"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Rejoindre } from "@/components/bs/rejoindre";

/**
 * Lien direct vers une fiche (depuis mon-ecurie.fr : « Créer mon accès Be
 * Stable ») ou vers l'ajout d'une écurie : le même parcours, à la bonne étape.
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
      <Rejoindre ficheId={Number(q.get("fiche")) || 0} creer={!!q.get("creer")} />
    </div>
  );
}
