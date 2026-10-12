/**
 * « Comment ça marche ici » : pour chaque écran, ce qu'on y voit et ce
 * qu'on peut y faire, en trois phrases au plus. La carte s'ouvre à la
 * première visite, le « ? » de l'en-tête la rouvre. Les mots sont ceux du
 * gérant, jamais ceux du code.
 */
export interface Aide {
  id: string;
  titre: string;
  points: string[];
}

const AIDES: Record<string, Aide> = {
  accueil: {
    id: "accueil",
    titre: "Ton accueil, chaque matin",
    points: [
      "Ton objectif du mois : ce que tu veux qu’il te reste une fois tout payé, et où tu en es.",
      "Ta journée : les séances, les soins et les tâches prévus aujourd’hui.",
      "Le + en bas de l’écran sert à tout noter : une séance, un soin, une dépense, une tâche. L’app range tout au bon endroit.",
    ],
  },
  planning: {
    id: "planning",
    titre: "Ton planning",
    points: [
      "Tout ce qui est prévu, jour par jour : séances, soins, tâches.",
      "Touche un créneau vide pour ajouter quelque chose à cette heure-là.",
      "Une fois la séance passée, confirme qu’elle a eu lieu : elle compte alors dans ce que tu gagnes et dans ce que le client te doit.",
    ],
  },
  valider: {
    id: "valider",
    titre: "Confirmer ce qui a eu lieu",
    points: [
      "Ici, les séances passées qui attendent ton accord.",
      "Confirmée, une séance compte dans ton bilan et dans ce que le client te doit.",
      "Annulée ou cavalier absent : dis-le, elle ne sera pas comptée.",
    ],
  },
  chevaux: {
    id: "chevaux",
    titre: "Ce que chaque cheval te laisse",
    points: [
      "Pour chaque cheval : ce qu’on te paie pour lui, moins ses soins, moins sa part des frais communs (foin, paille, loyer…).",
      "En vert, il te rapporte. En rose, il te coûte plus qu’il ne te paie.",
      "Passe sur « Clients » pour voir qui te fait le plus de chiffre d’affaires ce mois.",
    ],
  },
  ticket: {
    id: "ticket",
    titre: "Le ticket d’un cheval",
    points: [
      "Comme un ticket de caisse : ce qu’on te paie pour lui en haut, ce qu’il coûte en dessous, ce qu’il te laisse tout en bas.",
      "Sa part des frais communs, c’est le foin, la paille, le loyer… partagés entre tous tes chevaux.",
      "Son carnet garde ses soins et ce qui arrive bientôt : vermifuge, maréchal, vaccins.",
    ],
  },
  argent: {
    id: "argent",
    titre: "Ton bilan du mois",
    points: [
      "Ce qui est rentré, ce qui est sorti, et ce qu’il te reste.",
      "Il se remplit tout seul avec ce que tu notes : pensions, séances, soins, dépenses. Personne ne fait de comptabilité.",
      "Plus bas : des pistes pour gagner plus, ce qu’il reste à facturer, et tout ce qui est entré ou sorti.",
    ],
  },
  pilotage: {
    id: "pilotage",
    titre: "Ton bilan sur plusieurs mois",
    points: [
      "Les mêmes chiffres que le bilan du mois, sur 3, 6 ou 12 mois.",
      "Pour voir si ça s’améliore, et ce qui pèse le plus.",
    ],
  },
  seuil: {
    id: "seuil",
    titre: "Combien de chevaux pour ne pas perdre d’argent",
    points: [
      "Les frais communs (foin, loyer, salaires…) tombent chaque mois, quel que soit le nombre de chevaux.",
      "Ce chiffre te dit à partir de combien de chevaux ils sont payés.",
    ],
  },
  scenarios: {
    id: "scenarios",
    titre: "Et si… ?",
    points: [
      "Essaie un changement, une pension plus chère ou un cheval en plus, et regarde ce que ça donnerait.",
      "Rien ne change dans tes vrais chiffres.",
    ],
  },
  depenses: {
    id: "depenses",
    titre: "Tes dépenses",
    points: [
      "Tout ce que tu as payé ce mois.",
      "Une dépense pour un cheval va sur son ticket. Une dépense commune (foin, loyer…) se partage entre tous.",
    ],
  },
  equipe: {
    id: "equipe",
    titre: "Les tâches de l’équipe",
    points: [
      "Ce qu’il y a à faire à l’écurie, et qui s’en occupe.",
      "Ajoute une tâche, donne-la à quelqu’un, fais-la avancer jusqu’au bout.",
    ],
  },
  clients: {
    id: "clients",
    titre: "Tes clients",
    points: [
      "Les propriétaires des chevaux en pension et les cavaliers qui prennent des cours.",
      "Pour chacun : ses chevaux, ses séances du mois et ce qu’il te doit.",
      "Un nom noté dans une séance devient un client tout seul.",
    ],
  },
  prestations: {
    id: "prestations",
    titre: "Tes cours, services et prix",
    points: [
      "Pension, cours, balades… avec leur prix.",
      "Quand tu notes une séance, son prix se remplit tout seul.",
      "Tu vois aussi ce que chacune t’a rapporté ce mois.",
    ],
  },
  "ma-fiche": {
    id: "ma-fiche",
    titre: "Ta fiche sur mon-ecurie.fr",
    points: [
      "mon-ecurie.fr, c’est l’annuaire où les cavaliers cherchent une pension pour leur cheval.",
      "Places libres, prix, photos, présentation : une fois ta fiche validée, ce que tu changes ici apparaît sur l’annuaire.",
      "C’est gratuit, et aucune commission n’est prise sur tes pensions.",
    ],
  },
  moi: {
    id: "moi",
    titre: "Ton écurie et tes réglages",
    points: [
      "Le nom de ton écurie, ton objectif du mois, le rappel du matin.",
      "Tes chiffres restent sur ton téléphone, chiffrés. Tu peux en garder une copie.",
    ],
  },
};

/** L'aide d'un écran, d'après son adresse (« /argent?vue=… » compte comme « argent »). */
export function aidePour(path: string): Aide | undefined {
  const seg = path.replace(/^\/+/, "").split(/[/?#]/)[0];
  return AIDES[seg];
}
