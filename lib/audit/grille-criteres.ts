// Les critères de l'audit (repris de l'app du Clos, ~/Dreadsprint-v2/lib/grille-criteres.ts,
// le 27 novembre 2026), sans dépendance : lus par l'app et, plus tard, par le
// service d'audit du VPS qui lit Google, les annonces et les réseaux. Voir lib/audit/grille.ts.

export type VoletKey = "trouver" | "choisir" | "vivre";
export type Pts = 0 | 1 | 2;

export interface Critere {
  id: string;
  volet: VoletKey;
  titre: string; // la question, comme la pose un cavalier ou un gérant
  mesure: string; // où et comment on regarde
  regle: Record<Pts, string>; // ce que vaut 2, 1 ou 0
  pourquoi: string;
}

export interface Vu {
  ou: string;
  valeur: string;
  mauvais?: boolean;
}

export interface Geste {
  titre: string;
  qui: string;
  effort: string;
}

/** Ce que l'audit a trouvé pour un critère. `points: null` = à mesurer. */
export interface Resultat {
  points: Pts | null;
  constat: string; // en une phrase, ce qu'on a vu
  vu?: Vu[];
  geste?: Geste;
  question?: string; // pour un critère à mesurer : ce qu'on te demande
  sources?: string[]; // les pages lues par l’audit en ligne
}

export interface Volet {
  key: VoletKey;
  titre: string;
  scene: string;
  image: string;
  source: string;
  neSaitPas: string[];
}

export const VOLETS: Volet[] = [
  {
    key: "trouver",
    titre: "Te trouver",
    scene: "Il tape « pension cheval » et sa commune sur son téléphone.",
    image: "/img/presence/trouve.webp",
    source: "Google, Facebook, Instagram, Le Bon Coin, les sites d’annonces, bestable.fr",
    neSaitPas: ["Le bouche-à-oreille, et d’où viennent tes pensionnaires actuels.", "Ce qui se dit dans les groupes Facebook privés."],
  },
  {
    key: "choisir",
    titre: "Te choisir",
    scene: "Le soir, il compare deux ou trois écuries, puis il t’écrit.",
    image: "/img/presence/choisit.webp",
    source: "Ton site, tes annonces, ta fiche bestable.fr, tes demandes reçues",
    neSaitPas: ["La qualité réelle des prés et du service.", "Ta liste d’attente et les demandes que tu refuses."],
  },
  {
    key: "vivre",
    titre: "En vivre",
    scene: "Au bout du mois, ce que chaque cheval te laisse.",
    image: "/img/carnet/gerant-foin.webp",
    source: "Tes pensions, prestations et frais saisis dans l’app, et tes réponses",
    neSaitPas: ["Le coût de tes installations et de tes emprunts.", "Les aides que tu touches."],
  },
];

export const GRILLE: Critere[] = [
  // ---- Te trouver ----
  {
    id: "t-google", volet: "trouver", titre: "As-tu une fiche Google à ton nom ?",
    mesure: "Recherche Google Maps sur le nom de l’écurie et sa commune.",
    regle: { 2: "Fiche à ton nom, catégorie pension, horaires et site renseignés", 1: "Fiche présente mais incomplète", 0: "Pas de fiche, ou pas à toi" },
    pourquoi: "C’est le premier résultat que voit un cavalier qui cherche près de chez lui.",
  },
  {
    id: "t-avis", volet: "trouver", titre: "Que disent tes avis Google ?",
    mesure: "Nombre d’avis et note moyenne sur ta fiche.",
    regle: { 2: "10 avis ou plus, note de 4,5 ou plus", 1: "3 à 9 avis, ou note de 4 à 4,5", 0: "Moins de 3 avis, ou note sous 4" },
    pourquoi: "Avant d’appeler, il lit ce que disent les autres cavaliers.",
  },
  {
    id: "t-avis-recents", volet: "trouver", titre: "Tes avis sont-ils récents, et y réponds-tu ?",
    mesure: "Date du dernier avis et part des avis qui ont une réponse.",
    regle: { 2: "Un avis de moins de 3 mois et des réponses", 1: "Dernier avis de 3 à 12 mois, ou peu de réponses", 0: "Dernier avis de plus d’un an, aucune réponse" },
    pourquoi: "Un avis récent et une réponse montrent qu’il y a quelqu’un derrière.",
  },
  {
    id: "t-site", volet: "trouver", titre: "Ton site sort-il sur « pension cheval » et ta commune ?",
    mesure: "Position du site sur « pension cheval » suivi de ta commune et de la grande ville proche.",
    regle: { 2: "Dans les 5 premiers", 1: "Entre 6 et 10, ou sur une seule des deux recherches", 0: "Absent des 10 premiers, ou pas de site" },
    pourquoi: "Beaucoup de cavaliers ne vont pas plus loin que la première page.",
  },
  {
    id: "t-facebook", volet: "trouver", titre: "As-tu une page Facebook d’écurie ?",
    mesure: "Page d’écurie, sa dernière publication, et son lien avec le site.",
    regle: { 2: "Page active (publication de moins d’un mois), reliée au site", 1: "Page qui dort, ou pas reliée", 0: "Pas de page d’écurie" },
    pourquoi: "C’est là que beaucoup de cavaliers demandent une pension, dans les groupes du coin.",
  },
  {
    id: "t-instagram", volet: "trouver", titre: "Ton Instagram vit-il ?",
    mesure: "Dernière publication et rythme sur cinq semaines.",
    regle: { 2: "Au moins une publication par semaine", 1: "Une publication dans le mois", 0: "Rien depuis plus d’un mois, ou pas de compte" },
    pourquoi: "Il y regarde la vie de l’écurie : chevaux, prés, ambiance.",
  },
  {
    id: "t-annonces", volet: "trouver", titre: "Tes annonces sont-elles à jour ?",
    mesure: "Annonces sur Le Bon Coin, pension-chevaux.com, Chevalannonce, Equirodi : leur âge.",
    regle: { 2: "Toutes de moins d’un an, aucune en double", 1: "Une annonce de plus d’un an, ou en double", 0: "Plusieurs annonces anciennes, ou aucune" },
    pourquoi: "Une annonce de trois ans à côté d’une neuve fait douter des deux.",
  },
  {
    id: "t-bestable", volet: "trouver", titre: "Ta fiche bestable.fr est-elle à jour ?",
    mesure: "Fiche revendiquée, places confirmées, date de mise à jour.",
    regle: { 2: "Revendiquée, places confirmées il y a moins d’un mois", 1: "Revendiquée, places de plus d’un mois", 0: "Pas revendiquée" },
    pourquoi: "Les cavaliers y comparent les pensions de leur secteur.",
  },
  {
    id: "t-nap", volet: "trouver", titre: "Le même nom, la même adresse et le même numéro partout ?",
    mesure: "Nom, adresse et téléphone relevés sur chaque site.",
    regle: { 2: "Identiques partout", 1: "Une ou deux différences", 0: "Trois différences ou plus" },
    pourquoi: "Google s’en sert pour te classer, et le cavalier pour te faire confiance.",
  },
  {
    id: "t-lien", volet: "trouver", titre: "Tes annonces renvoient-elles vers toi ?",
    mesure: "Lien vers ton site ou ta fiche depuis chaque annonce.",
    regle: { 2: "Toutes renvoient vers toi", 1: "La moitié ou plus", 0: "Moins de la moitié" },
    pourquoi: "Sans lien, le cavalier intéressé reste sur l’annonce et compare avec les autres.",
  },

  // ---- Te choisir ----
  {
    id: "c-prix", volet: "choisir", titre: "Ton prix est-il affiché ?",
    mesure: "Prix de chaque formule sur ton site et tes annonces.",
    regle: { 2: "Prix de chaque formule affiché", 1: "Un prix « à partir de », ou une formule sur demande", 0: "Aucun prix affiché" },
    pourquoi: "Sans prix, il passe à l’écurie suivante plutôt que d’appeler.",
  },
  {
    id: "c-memes-prix", volet: "choisir", titre: "Les mêmes prix partout ?",
    mesure: "Prix relevés formule par formule, site par site.",
    regle: { 2: "Mêmes prix partout", 1: "Un écart sur une formule", 0: "Des écarts sur plusieurs formules" },
    pourquoi: "Deux prix différents, c’est le plus haut qu’il retient.",
  },
  {
    id: "c-compris", volet: "choisir", titre: "Ce qui est compris est-il écrit ?",
    mesure: "Foin, litière, sorties, soins : ce que dit la page pension.",
    regle: { 2: "Tout le compris est écrit", 1: "En partie", 0: "Rien n’est dit" },
    pourquoi: "C’est ce qui explique ton prix face au pré moins cher d’à côté.",
  },
  {
    id: "c-places", volet: "choisir", titre: "Dis-tu s’il y a de la place ?",
    mesure: "Places libres ou prochaine arrivée, et leur cohérence d’un site à l’autre.",
    regle: { 2: "Places dites, les mêmes partout", 1: "Places dites, mais qui se contredisent", 0: "Rien sur les places" },
    pourquoi: "C’est sa première question.",
  },
  {
    id: "c-capacite", volet: "choisir", titre: "Une seule capacité ?",
    mesure: "Nombre de chevaux annoncé sur chaque site.",
    regle: { 2: "Le même chiffre partout", 1: "Deux chiffres différents", 0: "Trois chiffres ou plus" },
    pourquoi: "Des chiffres qui changent font douter du reste.",
  },
  {
    id: "c-photos", volet: "choisir", titre: "Voit-on le lieu en photo ?",
    mesure: "Nombre de photos sur ton site et ta fiche Google.",
    regle: { 2: "10 photos ou plus, prés et installations", 1: "3 à 9 photos", 0: "Moins de 3" },
    pourquoi: "Il veut voir les prés et les abris avant de se déplacer.",
  },
  {
    id: "c-atout", volet: "choisir", titre: "Ton atout est-il dit tout de suite ?",
    mesure: "Ce qui te distingue, et où il apparaît sur ta page.",
    regle: { 2: "Dans la première phrase", 1: "Plus bas sur la page", 0: "Nulle part" },
    pourquoi: "Il compare trois écuries en quelques minutes : il retient ce qu’il lit en premier.",
  },
  {
    id: "c-conditions", volet: "choisir", titre: "Tes conditions d’entrée sont-elles écrites ?",
    mesure: "Préavis, caution, vaccins, ferrure, assurance.",
    regle: { 2: "Écrites", 1: "En partie", 0: "Pas écrites" },
    pourquoi: "Elles évitent les questions et les mauvaises surprises des deux côtés.",
  },
  {
    id: "c-joindre", volet: "choisir", titre: "Peut-on te joindre facilement ?",
    mesure: "Téléphone visible, formulaire de demande, bouton d’appel sur téléphone.",
    regle: { 2: "Numéro visible et formulaire ou bouton d’appel", 1: "Numéro seul", 0: "Il faut chercher" },
    pourquoi: "Il cherche le soir, sur son téléphone : il faut pouvoir écrire en un geste.",
  },
  {
    id: "c-reponse", volet: "choisir", titre: "Réponds-tu vite aux demandes ?",
    mesure: "Les demandes notées dans l’app : combien attendent, et depuis quand.",
    regle: { 2: "Aucune demande en attente de plus d’un jour", 1: "Une en attente", 0: "Plusieurs en attente" },
    pourquoi: "Une demande sans réponse rapide part souvent chez le voisin.",
  },

  // ---- En vivre (lu dans l'app) ----
  {
    id: "v-couvre", volet: "vivre", titre: "Chaque pension couvre-t-elle les frais de son cheval ?",
    mesure: "Pour chaque cheval en pension ce mois-ci : sa pension face à ses frais et à sa part des frais communs.",
    regle: { 2: "Toutes couvrent leurs frais", 1: "La moitié ou plus", 0: "Moins de la moitié" },
    pourquoi: "Une pension qui ne couvre pas son cheval se paie avec le reste.",
  },
  {
    id: "v-remplissage", volet: "vivre", titre: "Tes places sont-elles remplies ?",
    mesure: "Chevaux en pension dans l’app, face à ta capacité.",
    regle: { 2: "90 % ou plus", 1: "70 à 89 %", 0: "Moins de 70 %" },
    pourquoi: "Les frais fixes se partagent mieux quand l’écurie est pleine.",
  },
  {
    id: "v-prix", volet: "vivre", titre: "Chaque prestation a-t-elle un prix ?",
    mesure: "Prix fixés dans Mon écurie, prestation par prestation (ou tes tarifs).",
    regle: { 2: "Toutes", 1: "La moitié ou plus", 0: "Moins de la moitié" },
    pourquoi: "Sans prix, une prestation ne se compte pas : elle se donne.",
  },
  {
    id: "v-validees", volet: "vivre", titre: "Tes prestations sont-elles validées ?",
    mesure: "Prestations passées ce mois-ci et pas encore validées.",
    regle: { 2: "Aucune en attente", 1: "1 à 5 en attente", 0: "Plus de 5" },
    pourquoi: "Ce qui n’est pas validé n’arrive pas au décompte, ni à la facture.",
  },
  {
    id: "v-frais", volet: "vivre", titre: "Tes frais sont-ils notés ?",
    mesure: "Catégories de frais saisies pour le mois (foin, litière, maréchal…).",
    regle: { 2: "Trois catégories ou plus", 1: "Une ou deux", 0: "Aucune" },
    pourquoi: "Sans les frais, on ne sait pas ce que chaque cheval te laisse.",
  },
  {
    id: "v-sources", volet: "vivre", titre: "L’argent vient-il de plusieurs sources ?",
    mesure: "Pensions et séances validées dans le mois.",
    regle: { 2: "Pensions et séances", 1: "Une seule des deux", 0: "Rien de saisi ce mois-ci" },
    pourquoi: "Deux sources amortissent un départ ou un mois creux.",
  },
  {
    id: "v-objectif", volet: "vivre", titre: "As-tu un objectif pour le mois ?",
    mesure: "Les objectifs posés dans l’app : chiffre d’affaires visé, ou ce que tu veux qu’il te reste.",
    regle: { 2: "Un chiffre d’affaires visé", 1: "Seulement ce qu’il doit te rester", 0: "Aucun" },
    pourquoi: "Un chiffre visé dit tout de suite si le mois est en avance ou en retard.",
  },
  {
    id: "v-hausse", volet: "vivre", titre: "Quand as-tu revu tes prix pour la dernière fois ?",
    mesure: "Ta réponse.",
    regle: { 2: "Il y a moins de deux ans", 1: "Il y a deux à quatre ans", 0: "Plus de quatre ans, ou jamais" },
    pourquoi: "Le foin et le carburant augmentent chaque année ; un prix figé recule.",
  },
  {
    id: "v-foin", volet: "vivre", titre: "Connais-tu le coût de ton foin pour l’année ?",
    mesure: "Ta réponse.",
    regle: { 2: "Prix et tonnage connus, achat sécurisé", 1: "Prix connu, achat au fil de l’eau", 0: "Pas connu" },
    pourquoi: "C’est souvent le premier poste de frais, et celui qui bouge le plus.",
  },
  {
    id: "v-heures", volet: "vivre", titre: "Sais-tu combien d’heures demande l’écurie ?",
    mesure: "Ta réponse.",
    regle: { 2: "Heures connues, les tiennes et celles des autres", 1: "Une idée", 0: "Pas connu" },
    pourquoi: "C’est ce qui dit si ton travail est payé.",
  },
];

