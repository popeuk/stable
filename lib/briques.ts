/**
 * L'app en briques (décisions du 27 octobre 2026).
 *
 * Chaque partie de l'app est une brique qu'on ouvre ou qu'on verrouille selon
 * l'offre du compte, sans rien retirer :
 * - Vitrine et Demandes : gratuites, pour tous ;
 * - Mon argent (bilan, clients, chevaux) : 30 jours d'essai quand le gérant le
 *   décide, puis 6,99 € par mois ;
 * - Planning : compris dans l'offre « le site et Google » à 49 € ;
 * - Mon site : 19, 29 ou 49 €, payé sur le web, sans essai.
 *
 * Avant l'ouverture (OUVERTURE à faux), Mon argent, le planning et le site sont
 * « bientôt » : visibles en aperçu, avec une alerte « Me prévenir à l'ouverture ».
 *
 * Ce fichier ne lit rien : il reçoit l'état du compte et rend l'état de chaque
 * brique. Les écrans le lisent par useBriques (components/bs/briques.ts).
 */

export type BriqueId = "vitrine" | "demandes" | "argent" | "planning" | "site";

/**
 * - ouverte : la brique est à lui ;
 * - essai : ouverte, pendant les 30 jours d'essai de Mon argent ;
 * - cadenas : visible, avec un aperçu « Exemple » et le moyen de l'ouvrir ;
 * - bientot : avant l'ouverture, aperçu « Exemple » et « Me prévenir ».
 */
export type EtatBrique = "ouverte" | "essai" | "cadenas" | "bientot";

/** Les briques payantes, celles qui ont une alerte avant l'ouverture. */
export type AlerteId = "argent" | "planning" | "site" | "projet";

/** Les offres du site, en euros TTC par mois (0 : aucune). */
export type OffreSite = 0 | 19 | 29 | 49;

export interface EtatCompte {
  /** La session de l'appareil : la démo et l'écurie essayée sans compte gardent tout ouvert. */
  kind: "compte" | "demo" | "locale" | undefined;
  /** Mon argent, le planning et les sites sont-ils ouverts à la vente ? */
  ouvert: boolean;
  /** Le jour où le gérant a commencé l'essai de Mon argent (AAAA-MM-JJ), ou null. */
  essaiDebut: string | null;
  /** Ce qu'il a payé sur le web. */
  abonnement?: { argent?: boolean; site?: OffreSite };
  /** Aujourd'hui (AAAA-MM-JJ). */
  aujourdhui: string;
}

export const DUREE_ESSAI = 30;
/** Le jour de l'essai où partent l'e-mail et le SMS avec le lien de paiement. */
export const JOUR_RAPPEL = 25;

const jour = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/** Le jour de l'essai, de 1 (le jour où il commence) à 30 ; au-delà, l'essai est fini. */
export function jourEssai(debut: string, aujourdhui: string): number {
  return Math.max(1, Math.round((jour(aujourdhui) - jour(debut)) / 86_400_000) + 1);
}

/** L'état de chaque brique pour ce compte. */
export function etatsBriques(c: EtatCompte): Record<BriqueId, EtatBrique> {
  // La démo montre l'app entière ; l'écurie essayée sans compte garde le fonctionnement d'avant.
  if (c.kind !== "compte") return { vitrine: "ouverte", demandes: "ouverte", argent: "ouverte", planning: "ouverte", site: "ouverte" };
  const site = c.abonnement?.site ?? 0;
  let argent: EtatBrique;
  if (!c.ouvert) argent = "bientot";
  else if (c.abonnement?.argent) argent = "ouverte";
  else if (c.essaiDebut && jourEssai(c.essaiDebut, c.aujourdhui) <= DUREE_ESSAI) argent = "essai";
  else argent = "cadenas";
  return {
    vitrine: "ouverte",
    demandes: "ouverte",
    argent,
    planning: !c.ouvert ? "bientot" : site === 49 ? "ouverte" : "cadenas",
    site: !c.ouvert ? "bientot" : site > 0 ? "ouverte" : "cadenas",
  };
}

/** La brique est à lui (ouverte ou à l'essai). */
export const estOuverte = (e: EtatBrique) => e === "ouverte" || e === "essai";

/** L'essai peut-il commencer ? Seulement après l'ouverture, une fois, sans abonnement. */
export function essaiPossible(c: EtatCompte): boolean {
  return c.kind === "compte" && c.ouvert && !c.essaiDebut && !c.abonnement?.argent;
}
