"use client";

import { NoterRedirect } from "@/components/bs/redirect";

/** L’ancienne saisie d’un soin : la feuille du +, sur le soin. */
const prefill = () => ({ mode: "soin" as const });

export default function Page() {
  return <NoterRedirect prefill={prefill} />;
}
