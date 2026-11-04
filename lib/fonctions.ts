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
export const OUVERTURE: boolean = process.env.NEXT_PUBLIC_OUVERTURE === "1" || process.env.NEXT_PUBLIC_CLOS === "1";

/**
 * CLOS : la version interne du Clos de la Motte (4 novembre 2026, décision de
 * Samuel), servie à part sur le VPS (clos.187-7-74-179.sslip.io). Mon argent
 * y est montré et ouvert à tous les comptes, sans essai ni abonnement, et
 * l'écran des paliers du Clos (/paliers) s'ajoute à la partie argent. On la
 * construit avec NEXT_PUBLIC_CLOS=1 (.github/workflows/clos.yml).
 */
export const CLOS: boolean = process.env.NEXT_PUBLIC_CLOS === "1";

/**
 * ARGENT_VISIBLE : la partie argent (Mon bilan, Clients et chevaux, le +, le
 * planning) est-elle montrée ? Masquée le 29 octobre 2026 (décision de Samuel) :
 * l'app ne montre que la partie gratuite de la présence en ligne (Accueil,
 * Vitrine, Demandes, Audit, Apprendre). Le code et les données restent ; on la
 * rallume en posant NEXT_PUBLIC_ARGENT=1 à la construction.
 */
export const ARGENT_VISIBLE: boolean = process.env.NEXT_PUBLIC_ARGENT === "1" || CLOS;

/**
 * PAYANT_VISIBLE : ce qui se paie hors partie argent (Mon site, ses offres et
 * ses prix) se montre-t-il ? Masqué le 31 octobre 2026 (décision de Samuel) :
 * l'app ne montre que le gratuit. Le lien vers Mon site disparaît de la
 * Vitrine et de Mon écurie, et /mon-site ramène à la Vitrine. Le code et le
 * service des sites restent ; on le rallume en posant NEXT_PUBLIC_PAYANT=1 à la
 * construction. Rallumer la partie argent le rallume aussi.
 */
export const PAYANT_VISIBLE: boolean = ARGENT_VISIBLE || process.env.NEXT_PUBLIC_PAYANT === "1";

/**
 * APPRENDRE_VISIBLE : l'onglet Apprendre se montre-t-il ? Masqué le 31 octobre
 * 2026 (décision de Samuel) : la barre passe à quatre onglets (Accueil,
 * Vitrine, Demandes, Audit) et /apprendre ramène à l'accueil. La page reste ;
 * on la rallume en posant NEXT_PUBLIC_APPRENDRE=1 à la construction.
 */
export const APPRENDRE_VISIBLE: boolean = process.env.NEXT_PUBLIC_APPRENDRE === "1";

