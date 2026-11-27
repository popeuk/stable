import type { DayItem } from "@/lib/domain/seances";

/**
 * La journée en ligne du temps (27 novembre 2026, reprise de l'app du Clos) :
 * entre deux moments séparés d'une heure ou plus, un « Libre » dit le temps
 * qui reste ; aujourd'hui, un repère « Maintenant » se glisse à l'heure qu'il
 * est (sauf pendant une séance en cours, qui tient lieu de repère).
 * Domaine pur, testé.
 */

export type Pas = { kind: "item"; it: DayItem } | { kind: "libre"; minutes: number; key: string } | { kind: "maintenant"; key: string };

const min = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function enLigneDuTemps(items: DayItem[], maintenant: string | null): Pas[] {
  const out: Pas[] = [];
  let fin: string | null = null;
  let pose = maintenant == null;
  const enCours = maintenant != null && items.some((i) => i.start && i.end && i.start <= maintenant && i.end > maintenant);
  if (enCours) pose = true;
  items.forEach((it, n) => {
    if (it.start && fin && min(it.start) - min(fin) >= 60) {
      out.push({ kind: "libre", minutes: min(it.start) - min(fin), key: `libre-${n}` });
    }
    if (!pose && it.start && maintenant != null && it.start > maintenant) {
      out.push({ kind: "maintenant", key: `now-${n}` });
      pose = true;
    }
    out.push({ kind: "item", it });
    const f = it.end ?? it.start;
    if (f && (!fin || f > fin)) fin = f;
  });
  if (!pose && items.some((i) => i.start)) out.push({ kind: "maintenant", key: "now-fin" });
  return out;
}

/** « 3 h », « 1 h 30 », « 45 min ». */
export const duree = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`);
