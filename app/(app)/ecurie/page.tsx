"use client";

import { Redirect } from "@/components/bs/redirect";
import { useNav2 } from "@/components/bs/nav2";
import { MonEcurie } from "@/components/bs/carte-ecurie";
import { ClientGate } from "@/components/ui/client-gate";

/** Mon écurie (proposition ?nav=2) ; sans elle, l'ancienne adresse mène aux chevaux. */
export default function Page() {
  return (
    <ClientGate>
      <Ecurie />
    </ClientGate>
  );
}

function Ecurie() {
  return useNav2() ? <MonEcurie /> : <Redirect to="/chevaux" />;
}
