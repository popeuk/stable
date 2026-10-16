"use client";

import type { useDataStore } from "@/stores/data-store";
import { seanceAmount } from "@/lib/domain/seances";
import { currentPeriod, dateInPeriod } from "@/lib/utils/period";

/*
 * L'ancienne carte d'objectif de l'accueil est remplacée par le compteur du
 * mois (components/bs/compteur.tsx). Reste ici ce que Mon mois utilise.
 */

/** Ce qui est encore prévu ce mois-ci : séances à venir, moins les soins prévus. */
export function plannedRest(data: ReturnType<typeof useDataStore.getState>, today: string): number {
  const p = currentPeriod();
  const s = (data.seances ?? []).filter((x) => x.status === "planned" && x.date >= today && dateInPeriod(x.date, p)).reduce((t, x) => t + seanceAmount(x), 0);
  const c = (data.careEvents ?? []).filter((e) => e.pending && e.date >= today && dateInPeriod(e.date, p)).reduce((t, e) => t + (e.revenue ?? 0) - (e.cost ?? 0), 0);
  return s + c;
}
