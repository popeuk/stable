"use client";

import { EcranErreurDiffere } from "@/components/bs/ecran-erreur-differe";

/**
 * Un écran qui plante : l'écran d'erreur honnête (les chiffres ne sont pas
 * touchés), sans rien qui efface. L'écran de secours, lui, reste réservé aux
 * données abîmées à la lecture (`secours` du store, components/bs/secours.tsx).
 */
export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <EcranErreurDiffere error={error} onReessayer={() => unstable_retry()} />;
}
