"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adresseClient } from "@/lib/adresse-client";

/**
 * L'ancienne page « Mes clients » mène à la liste de l'onglet Clients ; `?q=Nom` ouvre directement la fiche du client.
 * Rien ne se perd : l'ajout et la recherche sont dans la liste, le
 * téléphone dans la fiche, les pros dans tes contacts.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Vers />
    </Suspense>
  );
}

function Vers() {
  const router = useRouter();
  const q = useSearchParams().get("q");
  useEffect(() => {
    router.replace(q ? adresseClient(q) : "/chevaux?vue=clients");
  }, [q, router]);
  return null;
}
