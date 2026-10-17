"use client";

import { Redirect } from "@/components/bs/redirect";
import { useNav2 } from "@/components/bs/nav2";
import { MonEcurie } from "@/components/bs/carte-ecurie";
import { ClientGate } from "@/components/ui/client-gate";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

/** Mon écurie (proposition ?nav=2) ; sans elle, l'ancienne adresse mène aux chevaux. */
export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <Ecurie />
      </Suspense>
    </ClientGate>
  );
}

function Ecurie() {
  // ?nav=2 arrive avec l'adresse : on ne redirige pas avant de l'avoir lu.
  const demande = useSearchParams().get("nav") === "2";
  return useNav2() || demande ? <MonEcurie /> : <Redirect to="/chevaux" />;
}
