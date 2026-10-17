"use client";

import type { useDataStore } from "@/stores/data-store";
import { dayItems } from "@/lib/domain/seances";
import { addDays } from "@/lib/domain/care";
import { currentPeriod } from "@/lib/utils/period";

/*
 * L'ancienne carte d'objectif de l'accueil est remplacée par le compteur du
 * mois (components/bs/compteur.tsx). Reste ici le « prévu », calculé d'une
 * seule façon pour tous les écrans (Accueil, Mon mois, Planning).
 */

type Data = ReturnType<typeof useDataStore.getState>;
const hhmm = (d = new Date()) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** La portée du prévu, écrite pareil partout. */
export const PORTEE_PREVU = "séances, soins et tâches";

/**
 * Ce qui est encore prévu sur ces jours : séances, soins et tâches à coût
 * qui n'ont pas encore compté (ni passés, ni faits). Les mêmes lignes que
 * Ta journée et le Planning, donc le même chiffre.
 */
export function prevuSur(data: Data, days: string[], today: string, now = hhmm()): number {
  return days
    .filter((d) => d >= today)
    .reduce((t, d) => t + dayItems(data, d, today, now).filter((i) => !i.done && !(i.type !== "task" && i.late)).reduce((u, i) => u + (i.money ?? 0), 0), 0);
}

/** Ce qui est encore prévu d'ici la fin du mois. */
export function plannedRest(data: Data, today: string, now = hhmm()): number {
  const p = currentPeriod();
  const days: string[] = [];
  for (let d = today; Number(d.slice(5, 7)) === p.month && Number(d.slice(0, 4)) === p.year; d = addDays(d, 1)) days.push(d);
  return prevuSur(data, days, today, now);
}
