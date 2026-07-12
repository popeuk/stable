"use client";

import { useEffect } from "react";
import { useDataStore } from "@/stores/data-store";
import { localToday } from "@/lib/utils/local-date";

/**
 * L'autopilote de l'écurie : à l'ouverture de l'app (et à chaque retour au
 * premier plan), les pensions du mois se postent et les rythmes de la
 * semaine se matérialisent. Le gérant n'a rien demandé, rien saisi : le
 * logiciel travaille en arrière-plan, comme promis.
 */
export function Autopilot() {
  const hydrated = useDataStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    const run = () => useDataStore.getState().runAutopilot(localToday());
    run();
    const onVisible = () => {
      if (!document.hidden) run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [hydrated]);

  return null;
}
