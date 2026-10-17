"use client";

import { MonEcurie } from "@/components/bs/carte-ecurie";
import { ClientGate } from "@/components/ui/client-gate";

/** Mon écurie : ce qu'elle vend, ce qu'elle paie, ses gens, ses papiers. */
export default function Page() {
  return (
    <ClientGate>
      <MonEcurie />
    </ClientGate>
  );
}
