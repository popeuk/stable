import type { ChangementPrevu, Horse } from "./types";

/**
 * Les changements de formule ou de prix programmés (version du Clos).
 *
 * Un cheval garde sa formule et son prix du moment dans pensionType et pension :
 * tout le reste de l'app les lit tels quels. Un changement à venir attend dans
 * `aVenir` ; quand son mois arrive, il remplace la formule et le prix, et quitte
 * la liste. Les mois d'avant ne bougent pas (leurs pensions sont déjà posées).
 * Domaine pur.
 */

const MOIS = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Un changement bien formé : un mois, et au moins une formule ou un prix. */
export function changementValable(c: ChangementPrevu): boolean {
  return MOIS.test(c.depuis) && (c.pensionType !== undefined || (c.pension !== undefined && Number.isFinite(c.pension) && c.pension >= 0));
}

/** Ajoute (ou remplace, au même mois) un changement programmé, dans l'ordre des mois. */
export function programmer(h: Horse, c: ChangementPrevu): Horse {
  const autres = (h.aVenir ?? []).filter((x) => x.depuis !== c.depuis);
  return { ...h, aVenir: [...autres, { ...c }].sort((a, b) => a.depuis.localeCompare(b.depuis)) };
}

/** Retire le changement programmé d'un mois. */
export function annuler(h: Horse, depuis: string): Horse {
  const reste = (h.aVenir ?? []).filter((x) => x.depuis !== depuis);
  return { ...h, aVenir: reste.length ? reste : undefined };
}

/** Applique à un cheval les changements dont le mois est arrivé (le dernier gagne). */
export function appliquerDus(h: Horse, mois: string): { cheval: Horse; appliques: ChangementPrevu[] } {
  const dus = (h.aVenir ?? []).filter((c) => c.depuis <= mois).sort((a, b) => a.depuis.localeCompare(b.depuis));
  if (!dus.length) return { cheval: h, appliques: [] };
  let next: Horse = { ...h };
  for (const c of dus) {
    if (c.pensionType !== undefined) next = { ...next, pensionType: c.pensionType || undefined };
    if (c.pension !== undefined) next = { ...next, pension: c.pension > 0 ? c.pension : undefined };
  }
  const reste = (h.aVenir ?? []).filter((c) => c.depuis > mois);
  next = { ...next, aVenir: reste.length ? reste : undefined };
  return { cheval: next, appliques: dus };
}

/** Tous les chevaux à jour pour ce mois, et ceux qui ont changé. */
export function chevauxAJour(horses: Horse[], mois: string): { horses: Horse[]; changes: { horseId: string; appliques: ChangementPrevu[] }[] } {
  const changes: { horseId: string; appliques: ChangementPrevu[] }[] = [];
  const out = horses.map((h) => {
    const { cheval, appliques } = appliquerDus(h, mois);
    if (appliques.length) changes.push({ horseId: h.id, appliques });
    return cheval;
  });
  return { horses: changes.length ? out : horses, changes };
}

/** « À partir de décembre 2026 : Pension travail, 490 € » */
export function changementEnMots(c: ChangementPrevu): string {
  const [y, m] = c.depuis.split("-").map(Number);
  const mois = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
  const quoi = [c.pensionType, c.pension === undefined ? "" : c.pension > 0 ? `${new Intl.NumberFormat("fr-FR").format(c.pension)} € par mois` : "plus de pension"].filter(Boolean).join(", ");
  return `À partir de ${mois} : ${quoi}`;
}
