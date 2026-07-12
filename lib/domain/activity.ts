import type { ISODate } from "@/lib/domain/types";
import type { CareEvent, CareKind } from "@/lib/domain/care";
import { addDays } from "@/lib/domain/care";

/**
 * L'activité des chevaux, dérivée du planning exécuté : personne ne remplit
 * de « suivi d'utilisation », il tombe tout seul des séances confirmées.
 * Domaine pur, testé, zéro framework.
 */
const WORK_KINDS: CareKind[] = [
  "cours_collectif",
  "cours_individuel",
  "entrainement",
  "concours",
];

export interface HorseActivity {
  horseId: string;
  /** Séances faites (confirmées) sur la fenêtre. */
  sessions: number;
  /** Recettes générées par ces séances. */
  revenue: number;
  /** Date de la dernière séance, s'il y en a une. */
  lastDate?: ISODate;
}

/**
 * Les séances de travail confirmées par cheval actif sur les `days`
 * derniers jours, triées de la plus travaillée à la moins travaillée.
 * Les chevaux sans aucune séance restent listés : ce sont eux le signal.
 */
export function horseActivity(
  data: {
    horses: { id: string; isArchived: boolean }[];
    careEvents?: CareEvent[];
  },
  today: ISODate,
  days = 30,
): HorseActivity[] {
  const from = addDays(today, -days);
  const byHorse = new Map<string, HorseActivity>();
  for (const h of data.horses) {
    if (!h.isArchived) byHorse.set(h.id, { horseId: h.id, sessions: 0, revenue: 0 });
  }
  for (const e of data.careEvents ?? []) {
    if (e.pending || !WORK_KINDS.includes(e.kind)) continue;
    if (e.date > today || e.date <= from) continue;
    const acc = byHorse.get(e.horseId);
    if (!acc) continue;
    acc.sessions += 1;
    acc.revenue += e.revenue ?? 0;
    if (!acc.lastDate || e.date > acc.lastDate) acc.lastDate = e.date;
  }
  return [...byHorse.values()].sort(
    (a, b) => b.sessions - a.sessions || b.revenue - a.revenue,
  );
}
