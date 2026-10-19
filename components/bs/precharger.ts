/**
 * Chargé une fois la page calme (components/bs/coque-legere.tsx) : ce qui ne
 * s'ouvre qu'à la demande arrive dans le cache du service worker, pour
 * marcher ensuite sans réseau. Sa liste ne pèse pas sur le premier affichage.
 */
void import("@/components/bs/moyen-paiement");
void import("@/components/bs/contact-feuille");
void import("@/components/bs/demandes-feuille");
void import("@/components/bs/secours");
void import("@/components/bs/ecran-erreur");
void import("@/components/bs/onglet-en-pause");

export {};
