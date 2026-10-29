/**
 * Interrupteurs de l'app.
 *
 * FACTURATION : facturation et suivi des paiements masqués le 26 octobre 2026,
 * Be Stable devient une app de rentabilisation (ce qu'un client rapporte, pas
 * ce qu'il doit). Le code et les données restent ; passer à true pour les rallumer.
 */
export const FACTURATION: boolean = false;

/**
 * OUVERTURE : Mon argent (essai et abonnement), le planning et les sites sont-ils
 * ouverts à la vente ? Tant que non (décision du 27 octobre 2026), ils restent
 * visibles en aperçu avec l'alerte « Me prévenir à l'ouverture » (lib/briques.ts).
 * On ouvre en posant NEXT_PUBLIC_OUVERTURE=1 à la construction.
 */
export const OUVERTURE: boolean = process.env.NEXT_PUBLIC_OUVERTURE === "1";

/**
 * ARGENT_VISIBLE : la partie argent (Mon bilan, Clients et chevaux, le +, le
 * planning) est-elle montrée ? Masquée le 29 octobre 2026 (décision de Samuel) :
 * l'app ne montre que la partie gratuite de la présence en ligne (Accueil,
 * Vitrine, Demandes, Audit, Apprendre). Le code et les données restent ; on la
 * rallume en posant NEXT_PUBLIC_ARGENT=1 à la construction.
 */
export const ARGENT_VISIBLE: boolean = process.env.NEXT_PUBLIC_ARGENT === "1";

