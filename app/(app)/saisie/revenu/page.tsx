"use client";

import { NoterRedirect } from "@/components/bs/redirect";

/** L’ancienne saisie d’une recette : la feuille du +, sur ce qui rentre. */
const prefill = () => ({ kind: "recette" as const });

export default function Page() {
  return <NoterRedirect prefill={prefill} />;
}
