"use client";

import { useEffect } from "react";
import { useDataStore } from "@/stores/data-store";
import { localToday } from "@/lib/utils/local-date";

const hhmm = (d = new Date()) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const CINQ_MINUTES = 5 * 60_000;

/**
 * L'autopilote de l'écurie : à l'ouverture de l'app (et à chaque retour au
 * premier plan), les pensions du mois se postent et les rythmes de la
 * semaine se matérialisent. Puis les soins passés comptent tout seuls, à
 * l'ouverture, toutes les 5 minutes et au retour au premier plan. Les
 * séances passées, elles, attendent d'être validées (« À valider »,
 * décision du 27 novembre 2026).
 */
export function Autopilot() {
  const hydrated = useDataStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    const compter = () => useDataStore.getState().compterLePasse(localToday(), hhmm());
    const run = () => {
      useDataStore.getState().runAutopilot(localToday());
      compter();
    };
    run();
    const onVisible = () => {
      if (!document.hidden) run();
    };
    document.addEventListener("visibilitychange", onVisible);
    const t = setInterval(() => {
      if (!document.hidden) compter();
    }, CINQ_MINUTES);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(t);
    };
  }, [hydrated]);

  return null;
}
