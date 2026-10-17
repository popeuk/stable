"use client";

import { useEffect } from "react";
import { SecoursEcran } from "@/components/bs/secours";
import { useDataStore } from "@/stores/data-store";

/**
 * Un écran qui tombe malgré la lecture prudente des données : l'écran de
 * secours, avec ce qui reste à exporter, plutôt qu'une page blanche.
 */
export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <SecoursEcran
      problemes={[]}
      garder="Réessayer"
      onGarder={() => unstable_retry()}
      onRepartir={() => {
        useDataStore.getState().quitterSecours("repartir");
        window.location.reload();
      }}
    />
  );
}
