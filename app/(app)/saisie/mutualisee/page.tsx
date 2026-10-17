"use client";

import { NoterRedirect } from "@/components/bs/redirect";

/** L’ancienne saisie d’un frais commun : la feuille du +, sur les frais de l’écurie. */
const prefill = () => ({ kind: "commune" as const });

export default function Page() {
  return <NoterRedirect prefill={prefill} />;
}
