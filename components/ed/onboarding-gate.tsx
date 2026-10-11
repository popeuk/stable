"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSettingsStore } from "@/stores/settings-store";
import { useDataStore } from "@/stores/data-store";
import { getSession } from "@/lib/account/session";

/**
 * Le portier de l'app : sans compte (ni démo), retour à l'accueil ; avec un
 * compte dont l'écurie n'est pas encore installée, direction le parcours.
 * Il attend que les données du compte soient chargées avant de décider.
 */
export function OnboardingGate() {
  const router = useRouter();
  const path = usePathname() ?? "";
  const parcours = useSettingsStore((s) => s.parcours);
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

  useEffect(() => {
    if (!ready) return;
    if (!getSession()) {
      router.replace("/bienvenue");
      return;
    }
    const setup = parcours.chevaux && parcours.tarifs && parcours.factures;
    if (!setup && !path.startsWith("/parcours") && !path.startsWith("/bienvenue") && !path.startsWith("/compte") && !path.startsWith("/ma-fiche")) router.replace("/parcours");
  }, [ready, parcours, path, router]);

  return null;
}
