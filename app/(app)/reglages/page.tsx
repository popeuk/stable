"use client";

import { Reglages } from "@/components/bs/carte-ecurie";
import { ClientGate } from "@/components/ui/client-gate";

/** Réglages de l'app seule (proposition ?nav=2). */
export default function Page() {
  return (
    <ClientGate>
      <Reglages />
    </ClientGate>
  );
}
