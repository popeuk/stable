"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EntreeDirecte } from "@/components/bs/entree-directe";
import { ArriveeFiche } from "@/components/bs/arrivee-fiche";

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
  const router = useRouter();
  // Depuis « C'est mon écurie » sur bestable.fr (?fiche=ID) : l'arrivée par la fiche, sans histoire (lot 5).
  const fiche = Number(q.get("fiche")) || 0;
  const depuis = q.get("depuis");
  const retour = () => (depuis === "ecurie" ? router.push("/ecurie") : q.get("retrouver") ? router.push("/ma-fiche") : window.history.length > 1 ? router.back() : router.push("/bienvenue"));
  return (
    <div className="carnet">
      {fiche ? (
        <ArriveeFiche key={fiche} ficheId={fiche} />
      ) : (
        // Depuis l'app : retrouver sa fiche (?retrouver=1) ou ajouter son écurie (?creer=1), sans repasser par l'histoire.
        <EntreeDirecte depart={q.get("creer") ? "ajout" : "cherche"} retour={retour} />
      )}
    </div>
  );
}
