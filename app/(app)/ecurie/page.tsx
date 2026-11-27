"use client";

import { MonEcurie } from "@/components/bs/carte-ecurie";
import { ClientGate } from "@/components/ui/client-gate";
import { QUATRE_PARTIES } from "@/lib/fonctions";
import { Redirect } from "@/components/bs/redirect";

/** Mon écurie : ce qu'elle vend, ce qu'elle paie, ses gens, ses papiers. Avec les cinq onglets : la brique des chiffres. */
export default function Page() {
  // Les cinq onglets du Clos : Mon écurie s'ouvre sur les clients ; l'ancien « Plus » est parti dans Suivi et les Réglages.
  if (QUATRE_PARTIES) return <Redirect to="/chevaux?vue=clients" />;
  return (
    <ClientGate>
      <MonEcurie />
    </ClientGate>
  );
}
