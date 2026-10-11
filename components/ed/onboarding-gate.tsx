"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * Tant que l'écurie n'est pas installée (les trois premiers obstacles du
 * parcours), on renvoie au départ du parcours. Après, l'app est libre.
 */
export function OnboardingGate() {
  const router = useRouter();
  const path = usePathname() ?? "";
  const parcours = useSettingsStore((s) => s.parcours);
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    const setup = parcours.chevaux && parcours.tarifs && parcours.factures;
    if (!setup && !path.startsWith("/parcours") && !path.startsWith("/bienvenue")) router.replace("/bienvenue");
  }, [mounted, parcours, path, router]);

  return null;
}
