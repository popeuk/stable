import type { ISODate } from "@/lib/domain/types";
import { moisDit, pensionDuMois } from "@/lib/domain/autopilot";

/**
 * Ce que dit la fiche d'un cheval arrivé en cours de mois (le mois de
 * `today`) : sa pension de ce mois est au prorata, ou déjà facturée et
 * inchangée. Rien s'il est arrivé un 1er, avant ce mois, ou sans pension.
 */
export function textePensionArrivee(pension: number | undefined, entree: ISODate | undefined, today: ISODate, facturee = false): string {
  if (!pension || pension <= 0 || !entree || entree.slice(0, 7) !== today.slice(0, 7)) return "";
  const { amount, note } = pensionDuMois(pension, entree);
  if (!note) return "";
  const nom = moisDit(Number(entree.slice(0, 4)), Number(entree.slice(5, 7)));
  const mois = /^[aeiouyâ]/i.test(nom) ? `d’${nom}` : `de ${nom}`;
  if (facturee) return `Sa pension ${mois} est déjà facturée : elle ne change pas.`;
  const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
  return `Arrivée en cours de mois : sa pension ${mois} est comptée au prorata, ${note.replace(/^Pension /, "")} (${eur}).`;
}
