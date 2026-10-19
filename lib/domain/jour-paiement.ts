import { addDays } from "@/lib/domain/care";

/**
 * Le jour d'un paiement reçu : aujourd'hui par défaut, ou hier, avant-hier,
 * un autre jour (jamais dans le futur). Ce jour devient l'horodatage du
 * paiement (`at`), que lisent l'historique de la fiche client, le fichier du
 * comptable (lib/domain/comptable) et « Payée le … » de la facture
 * (regleeDe). Domaine pur.
 */

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Les trois jours proposés en puces. */
export function joursProposes(today: string): { date: string; label: string }[] {
  return [
    { date: today, label: "Aujourd’hui" },
    { date: addDays(today, -1), label: "Hier" },
    { date: addDays(today, -2), label: "Avant-hier" },
  ];
}

/** Un jour qu'on peut choisir : une vraie date AAAA-MM-JJ, au plus aujourd'hui. */
export function jourPossible(date: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T12:00:00`);
  return !isNaN(d.getTime()) && date <= today;
}

/**
 * L'horodatage du paiement : maintenant s'il est d'aujourd'hui (l'ordre des
 * paiements du jour reste le bon), sinon midi, heure de l'appareil, ce jour-là.
 */
export function horodatage(date: string, today: string, maintenant: Date = new Date()): string {
  if (date === today || !jourPossible(date, today)) return maintenant.toISOString();
  return new Date(`${date}T12:00:00`).toISOString();
}

/** « aujourd’hui », « hier », « avant-hier », sinon « le 12 octobre ». */
export function jourDit(date: string, today: string): string {
  if (date === today) return "aujourd’hui";
  if (date === addDays(today, -1)) return "hier";
  if (date === addDays(today, -2)) return "avant-hier";
  const [, m, j] = date.split("-").map(Number);
  return `le ${j === 1 ? "1er" : j} ${MOIS[m - 1]}`;
}
