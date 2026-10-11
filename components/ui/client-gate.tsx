"use client";

import { useEffect, useState } from "react";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * N'affiche l'écran qu'une fois les données du compte chargées (et
 * déchiffrées) : sans ça, l'écran partirait des données d'exemple et
 * pourrait les enregistrer par-dessus celles du gérant.
 */
export function ClientGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const check = () => useDataStore.persist.hasHydrated() && useSettingsStore.persist.hasHydrated() && setReady(true);
    check();
    const a = useDataStore.persist.onFinishHydration(check);
    const b = useSettingsStore.persist.onFinishHydration(check);
    return () => {
      a();
      b();
    };
  }, []);
  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" aria-busy="true" aria-label="Chargement">
        <div className="size-6 animate-pulse rounded-full bg-[var(--accent-primary-soft)]" />
      </div>
    );
  }
  return <>{children}</>;
}
