"use client";

import { useRouter } from "next/navigation";
import { EntreeDirecte } from "@/components/bs/entree-directe";

/**
 * La porte d'entrée de quelqu'un qui ouvre l'app sans fiche ni demande (lot 6,
 * 27 octobre 2026) : l'histoire, puis l'onglet « Créer mon compte » de la
 * connexion, où l'on cherche son écurie (une seule page avec la connexion).
 */
export default function BienvenuePage() {
  const router = useRouter();
  return <EntreeDirecte versRecherche={() => router.push("/compte/connexion/?creer=1")} />;
}
