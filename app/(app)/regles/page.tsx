"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { TEXTES, TexteLegal, estTexte } from "@/components/bs/texte-legal";

/** Les règles (Réglages) : un texte légal du site, sans la navigation du site, dans l'écran de l'app. */
export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <Regles />
      </Suspense>
    </ClientGate>
  );
}

function Regles() {
  const router = useRouter();
  const q = useSearchParams().get("t");
  const t = estTexte(q) ? q : "confidentialite";
  return (
    <div className="ce">
      <header className="ce-hd rise">
        <h1>{TEXTES[t].titre}</h1>
        <p>Les mêmes règles pour Be Stable et mon-ecurie.fr.</p>
      </header>
      <TexteLegal t={t} onTexte={(c) => router.push(`/regles?t=${c}`)} />
    </div>
  );
}
