import type { Category, Horse, ISODate, Revenue } from "@/lib/domain/types";
import { debutCompte, finCompte, sejours } from "@/lib/domain/sejours";
import { periodEnd } from "@/lib/utils/period";

/**
 * L'autopilote des pensions : le loyer d'une place est un CONTRAT (le champ
 * pension du cheval), pas une saisie mensuelle. Chaque mois, le revenu de
 * pension de chaque cheval actif est posté tout seul — la rentabilité se
 * construit en arrière-plan, sans que le gérant ne touche à rien.
 * Domaine pur, testé, zéro framework.
 */

/** L'identifiant déterministe d'une pension auto-postée : l'idempotence. */
export function pensionRevenueId(horseId: string, monthKey: string): string {
  return `rev-pension-${horseId}-${monthKey}`;
}

/**
 * Les revenus de pension manquants, du mois `depuis` (AAAA-MM, le mois en
 * cours par défaut) jusqu'au mois en cours : les mois où l'app n'a pas été
 * ouverte sont rattrapés à la prochaine ouverture, sans doublon. Un cheval
 * dont la pension (€/mois) est renseignée reçoit son revenu de chaque mois
 * où il compte (ses séjours, lib/domain/sejours), sauf si une pension
 * existe déjà ce mois-là (saisie à la main ou déjà postée) ou si le gérant a
 * supprimé la ligne auto-postée (dismissed : on n'insiste pas).
 */
export function ensurePensions(
  data: {
    horses: Horse[];
    revenues: Revenue[];
    revenueCategories: Category[];
  },
  today: ISODate,
  dismissed: string[] = [],
  depuis?: string,
): Revenue[] {
  const pensionCat = data.revenueCategories.find(
    (c) => c.name.toLowerCase() === "pension",
  );
  if (!pensionCat) return [];

  const skip = new Set(dismissed);
  // Les chevaux déjà couverts, mois par mois (peu importe la source).
  const covered = new Set(
    data.revenues
      .filter((r) => r.categoryId === pensionCat.id)
      .map((r) => `${r.horseId}|${r.date.slice(0, 7)}`),
  );

  const out: Revenue[] = [];
  for (const monthKey of moisEntre(depuis, today.slice(0, 7))) {
    const monthStart = `${monthKey}-01`;
    const p = { year: Number(monthKey.slice(0, 4)), month: Number(monthKey.slice(5, 7)) };
    // Le mois en cours s'arrête aujourd'hui : un cheval qui arrive demain attend demain.
    const until = monthKey === today.slice(0, 7) ? today : periodEnd(p);
    for (const h of data.horses) {
      if (!h.pension || h.pension <= 0) continue;
      const stay = sejours(h).find((s) => {
        const f = finCompte(s);
        return debutCompte(s) <= until && (f === null || f >= monthStart);
      });
      if (!stay) continue;
      if (covered.has(`${h.id}|${monthKey}`)) continue;
      const rid = pensionRevenueId(h.id, monthKey);
      if (skip.has(rid)) continue;
      const from = debutCompte(stay);
      out.push({
        id: rid,
        stableId: h.stableId,
        horseId: h.id,
        categoryId: pensionCat.id,
        amount: h.pension,
        // Un cheval entré en cours de mois est facturé depuis son entrée.
        date: from > monthStart ? from : monthStart,
        source: "recurring",
      });
    }
  }
  return out;
}

/** Les mois de `depuis` à `jusqua` inclus (AAAA-MM), les 24 derniers au plus ; `jusqua` seul sans `depuis`. */
export function moisEntre(depuis: string | undefined, jusqua: string): string[] {
  if (!depuis || depuis >= jusqua) return [jusqua];
  const out: string[] = [];
  let y = Number(jusqua.slice(0, 4));
  let m = Number(jusqua.slice(5, 7));
  for (let i = 0; i < 24; i++) {
    const k = `${y}-${String(m).padStart(2, "0")}`;
    if (k < depuis) break;
    out.unshift(k);
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

/**
 * Le premier mois à rattraper : le mois suivant le dernier mois déjà vu par
 * l'autopilote ; pour une écurie d'avant ce repère, le dernier mois qui a
 * une pension notée. Rien de noté : le mois en cours seulement.
 */
export function premierMoisARattraper(
  data: { revenues: Revenue[]; revenueCategories: Category[] },
  today: ISODate,
  vuJusquA?: string,
): string {
  const cur = today.slice(0, 7);
  if (vuJusquA) return vuJusquA < cur ? vuJusquA : cur;
  const cat = data.revenueCategories.find((c) => c.name.toLowerCase() === "pension");
  const last = data.revenues
    .filter((r) => r.categoryId === cat?.id && r.date.slice(0, 7) <= cur)
    .map((r) => r.date.slice(0, 7))
    .sort()
    .at(-1);
  return last ?? cur;
}
