import type { Category, Horse, ISODate, Revenue } from "@/lib/domain/types";

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
 * Les revenus de pension manquants pour le mois en cours. Un cheval actif
 * dont la pension (€/mois) est renseignée reçoit son revenu du mois, sauf
 * si une pension existe déjà (saisie à la main ou déjà postée) ou si le
 * gérant a supprimé la ligne auto-postée (dismissed : on n'insiste pas).
 */
export function ensurePensions(
  data: {
    horses: Horse[];
    revenues: Revenue[];
    revenueCategories: Category[];
  },
  today: ISODate,
  dismissed: string[] = [],
): Revenue[] {
  const pensionCat = data.revenueCategories.find(
    (c) => c.name.toLowerCase() === "pension",
  );
  if (!pensionCat) return [];

  const monthKey = today.slice(0, 7);
  const monthStart = `${monthKey}-01`;
  const skip = new Set(dismissed);

  // Les chevaux déjà couverts ce mois-ci (peu importe la source).
  const covered = new Set(
    data.revenues
      .filter(
        (r) =>
          r.categoryId === pensionCat.id &&
          r.date.slice(0, 7) === monthKey,
      )
      .map((r) => r.horseId),
  );

  const out: Revenue[] = [];
  for (const h of data.horses) {
    if (h.isArchived || !h.pension || h.pension <= 0) continue;
    if (h.entryDate > today) continue;
    if (h.exitDate && h.exitDate < monthStart) continue;
    if (covered.has(h.id)) continue;
    const rid = pensionRevenueId(h.id, monthKey);
    if (skip.has(rid)) continue;
    out.push({
      id: rid,
      stableId: h.stableId,
      horseId: h.id,
      categoryId: pensionCat.id,
      amount: h.pension,
      // Un cheval entré en cours de mois est facturé depuis son entrée.
      date: h.entryDate > monthStart ? h.entryDate : monthStart,
      source: "recurring",
    });
  }
  return out;
}
