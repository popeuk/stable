import type { ISODate } from "@/lib/domain/types";
import type { CareEvent, CareKind } from "@/lib/domain/care";
import { addDays } from "@/lib/domain/care";

/**
 * Les rythmes de l'écurie : « le cours du soir, tous les mardis à 18 h ».
 * On planifie UNE fois ; chaque semaine, la séance apparaît toute seule à
 * l'agenda, en attente de confirmation. La feuille de présence fait le
 * reste : présents au carnet, recettes attribuées, rien à ressaisir.
 * Domaine pur, testé, zéro framework.
 */
export interface Rhythm {
  id: string;
  stableId: string;
  kind: CareKind;
  /** Jour de la semaine, 0 = lundi … 6 = dimanche. */
  weekday: number;
  /** « Cours du soir, 18 h »… */
  label?: string;
  provider?: string;
  horseIds: string[];
  /** Recette par cheval présent (un cours) : créée à la confirmation. */
  revenue?: number;
  /** Coût par cheval (une tournée de maréchal…). */
  cost?: number;
  active: boolean;
  /**
   * Occurrences générées jusqu'à cette date INCLUSE. Supprimer une séance
   * générée la supprime pour de bon : on ne régénère jamais en arrière.
   */
  materializedUntil: ISODate;
}

export const WEEKDAY_LABELS = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
];

/** Jour de la semaine d'une date ISO, 0 = lundi … 6 = dimanche. */
export function weekdayOf(iso: ISODate): number {
  return (new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7;
}

/** À combien de jours planifier la prochaine génération (l'horizon). */
export const RHYTHM_HORIZON_DAYS = 7;

export interface Materialized {
  /** Les nouvelles séances en attente à ajouter à l'agenda. */
  events: CareEvent[];
  /** Les bornes à avancer sur chaque rythme concerné. */
  advanced: { id: string; materializedUntil: ISODate }[];
}

/**
 * Fait avancer les rythmes : pour chaque rythme actif, génère les séances
 * (en attente) entre materializedUntil exclu et aujourd'hui + horizon
 * inclus, au jour de la semaine du rythme. Idempotent : les identifiants
 * sont déterministes et la borne avance à chaque passage.
 */
export function materializeRhythms(
  rhythms: Rhythm[],
  horses: { id: string; isArchived: boolean }[],
  today: ISODate,
  horizonDays: number = RHYTHM_HORIZON_DAYS,
): Materialized {
  const activeIds = new Set(horses.filter((h) => !h.isArchived).map((h) => h.id));
  const until = addDays(today, horizonDays);
  const events: CareEvent[] = [];
  const advanced: Materialized["advanced"] = [];

  for (const r of rhythms) {
    if (!r.active) continue;
    if (r.materializedUntil >= until) continue;
    const riders = r.horseIds.filter((hid) => activeIds.has(hid));
    // La borne avance même sans cavalier : le rythme ne « rattrape » jamais.
    for (
      let d = addDays(r.materializedUntil, 1);
      d <= until;
      d = addDays(d, 1)
    ) {
      if (weekdayOf(d) !== r.weekday) continue;
      // Une séance passée jamais générée ne réapparaît pas dans le passé.
      if (d < today) continue;
      for (const horseId of riders) {
        events.push({
          id: `care-rh-${r.id}-${d}-${horseId}`,
          stableId: r.stableId,
          horseId,
          kind: r.kind,
          date: d,
          label: r.label,
          provider: r.provider,
          cost: r.cost,
          revenue: r.revenue,
          groupId: `rh-${r.id}-${d}`,
          pending: true,
        });
      }
    }
    advanced.push({ id: r.id, materializedUntil: until });
  }
  return { events, advanced };
}
