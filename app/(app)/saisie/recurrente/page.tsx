"use client";

import { NoterRedirect } from "@/components/bs/redirect";

/** L’ancienne saisie d’une dépense qui revient : la feuille du +, sur ce qui sort (le rythme est dans « Plus de détails »). */
const prefill = () => ({ kind: "depense" as const });

export default function Page() {
  return <NoterRedirect prefill={prefill} />;
}
