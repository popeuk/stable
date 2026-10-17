"use client";

import { Reglages } from "@/components/bs/carte-ecurie";
import { ClientGate } from "@/components/ui/client-gate";

/** Réglages : l'app seule, sur ce téléphone (compte, rappel, affichage, revoir, avancé). */
export default function Page() {
  return (
    <ClientGate>
      <Reglages />
    </ClientGate>
  );
}
