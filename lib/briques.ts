/**
 * L'app en briques (27 octobre 2026), une seule offre depuis le 26 novembre 2026.
 *
 * Chaque partie de l'app est une brique qu'on ouvre ou qu'on verrouille selon
 * l'offre du compte, sans rien retirer :
 * - la Vitrine (l'accueil et la fiche bestable.fr) et les Demandes : gratuites,
 *   pour tous ;
 * - tout le reste (Te trouver, Te choisir, Mon argent, le planning, Mon site) :
 *   un seul abonnement, 29,99 € par mois, tout compris (décision de Samuel,
 *   26 novembre 2026), avec 7 jours d'essai quand le gérant le décide.
 *
 * Avant l'ouverture (OUVERTURE à faux), les briques payantes sont « bientôt » :
 * visibles en aperçu, avec « Me prévenir à l'ouverture » là où le site le sait.
 *
 * Ce fichier ne lit rien : il reçoit l'état du compte et rend l'état de chaque
 * brique. Les écrans le lisent par useBriques (components/bs/briques.ts).
 */

export type BriqueId = "vitrine" | "demandes" | "argent" | "planning" | "site" | "trouver" | "choisir";

/**
 * - ouverte : la brique est à lui ;
 * - essai : ouverte, pendant les 7 jours d'essai ;
 * - cadenas : visible, avec un aperçu « Exemple » et le moyen de l'ouvrir ;
 * - bientot : avant l'ouverture, aperçu « Exemple » et « Me prévenir ».
 */
export type EtatBrique = "ouverte" | "essai" | "cadenas" | "bientot";

/** Les briques payantes, celles qui ont une alerte avant l'ouverture. */
export type AlerteId = "argent" | "planning" | "site" | "projet";

/** L'abonnement unique, en euros TTC par mois. */
export const PRIX_MOIS = "29,99\u00a0€";

export interface EtatCompte {
  /** La session de l'appareil : la démo et l'écurie essayée sans compte gardent tout ouvert. */
  kind: "compte" | "demo" | "locale" | undefined;
  /** Mon argent, le planning et les sites sont-ils ouverts à la vente ? */
  ouvert: boolean;
  /** Le jour où le gérant a commencé l'essai (AAAA-MM-JJ), ou null. */
  essaiDebut: string | null;
  /** A-t-il payé l'abonnement sur le web ? */
  abonne?: boolean;
  /** Aujourd'hui (AAAA-MM-JJ). */
  aujourdhui: string;
  /** Tout ouvert, sans cadenas ni essai : la préproduction des cinq onglets (décision de Samuel, 27 novembre 2026). */
  toutOuvert?: boolean;
}

export const DUREE_ESSAI = 7;
/** Le jour de l'essai où partent l'e-mail et le SMS avec le lien de paiement (côté site, à aligner : il comptait sur 25). */
export const JOUR_RAPPEL = 5;

const jour = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/** Le jour de l'essai, de 1 (le jour où il commence) à 7 ; au-delà, l'essai est fini. */
export function jourEssai(debut: string, aujourdhui: string): number {
  return Math.max(1, Math.round((jour(aujourdhui) - jour(debut)) / 86_400_000) + 1);
}

/** L'état de chaque brique pour ce compte. */
export function etatsBriques(c: EtatCompte): Record<BriqueId, EtatBrique> {
  // La démo montre l'app entière ; l'écurie essayée sans compte garde le fonctionnement d'avant.
  if (c.kind !== "compte" || c.toutOuvert) return { vitrine: "ouverte", demandes: "ouverte", argent: "ouverte", planning: "ouverte", site: "ouverte", trouver: "ouverte", choisir: "ouverte" };
  let payant: EtatBrique;
  if (!c.ouvert) payant = "bientot";
  else if (c.abonne) payant = "ouverte";
  else if (c.essaiDebut && jourEssai(c.essaiDebut, c.aujourdhui) <= DUREE_ESSAI) payant = "essai";
  else payant = "cadenas";
  // Un seul abonnement : toutes les briques payantes ont le même état.
  return { vitrine: "ouverte", demandes: "ouverte", argent: payant, planning: payant, site: payant, trouver: payant, choisir: payant };
}

/** La brique est à lui (ouverte ou à l'essai). */
export const estOuverte = (e: EtatBrique) => e === "ouverte" || e === "essai";

/** L'essai peut-il commencer ? Seulement après l'ouverture, une fois, sans abonnement. */
export function essaiPossible(c: EtatCompte): boolean {
  return c.kind === "compte" && c.ouvert && !c.essaiDebut && !c.abonne;
}
