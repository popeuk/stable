"use client";

import { NoterRedirect } from "@/components/bs/redirect";

/** L’ancienne saisie d’une dépense : la feuille du +, sur ce qui sort. */
const prefill = () => ({ kind: "depense" as const });

export default function Page() {
  return <NoterRedirect prefill={prefill} />;
}
