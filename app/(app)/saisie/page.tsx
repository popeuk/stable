"use client";

import { NoterRedirect } from "@/components/bs/redirect";

/** L’ancien composeur « Noter » : la feuille du +, sur l’argent (?kind=charge pour ce qui sort). */
const prefill = (q: URLSearchParams) => ({ kind: q.get("kind") === "charge" ? ("depense" as const) : ("recette" as const) });

export default function Page() {
  return <NoterRedirect prefill={prefill} />;
}
