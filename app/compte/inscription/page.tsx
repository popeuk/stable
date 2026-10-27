"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession } from "@/lib/account/session";
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

/** Le nom tapé dans « Trouve ton écurie » quand rien n'a été trouvé (déposé par la connexion, lu une fois). */
function nomPropose(): string {
  if (typeof window === "undefined") return "";
  try {
    const n = sessionStorage.getItem("bs-ajout-nom") ?? "";
    sessionStorage.removeItem("bs-ajout-nom");
    return n;
  } catch {
    return "";
  }
}

function Inscription() {
  const q = useSearchParams();
  const router = useRouter();
  const [nom] = useState(nomPropose);
  // Depuis « C'est mon écurie » sur bestable.fr (?fiche=ID) : l'arrivée par la fiche, sans histoire (lot 5).
  const fiche = Number(q.get("fiche")) || 0;
  const depuis = q.get("depuis");
  const retour = () =>
    depuis === "ecurie"
      ? router.push("/ecurie")
      : q.get("retrouver")
        ? router.push("/ma-fiche")
        : window.history.length > 1
          ? router.back()
          : router.push("/bienvenue");
  return (
    <div className="carnet">
      {fiche ? (
        <ArriveeFiche key={fiche} ficheId={fiche} />
      ) : (
        // Retrouver sa fiche depuis l'app (?retrouver=1) : l'écran « Trouve ton écurie ».
        // Ajouter son écurie (?creer=1) ou un projet (?projet=1), venus de « Créer mon compte » :
        // le retour à la recherche ramène à la connexion, où la recherche vit désormais.
        <EntreeDirecte
          depart={
            q.get("creer") ? "ajout" : q.get("projet") ? "projet" : "cherche"
          }
          retour={retour}
          nom={nom}
          versRecherche={
            q.get("retrouver") || depuis
              ? undefined
              : // Déjà connecté, la connexion le renverrait à l'accueil : il cherche sur « Trouve ton écurie ».
                () =>
                  router.push(
                    getSession()?.kind === "compte"
                      ? "/compte/inscription/?retrouver=1"
                      : "/compte/connexion/?creer=1",
                  )
          }
        />
      )}
    </div>
  );
}
