"use client";

import { MonEcurie, MonEcurieCinq } from "@/components/bs/carte-ecurie";
import { ClientGate } from "@/components/ui/client-gate";
import { QUATRE_PARTIES } from "@/lib/fonctions";

/** Mon écurie : ce qu'elle vend, ce qu'elle paie, ses gens, ses papiers. Avec les cinq onglets : la brique des chiffres. */
export default function Page() {
  return <ClientGate>{QUATRE_PARTIES ? <MonEcurieCinq /> : <MonEcurie />}</ClientGate>;
}
