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
      "En haut, ce qu’il te reste ce mois une fois tout payé. Touche-le pour voir d’où ça vient.",
      "Ta journée : les séances, les soins et les tâches prévus aujourd’hui.",
      "Ce qui a eu lieu compte tout seul. Pas eu lieu ? Retire la ligne.",
      "Le + en bas de l’écran sert à tout ajouter : une séance, un soin, une tâche, de l’argent.",
    ],
  },
  planning: {
    id: "planning",
    titre: "Ton planning",
    points: [
      "Tout ce qui est prévu, jour par jour : séances, soins, tâches.",
      "Touche un créneau vide pour ajouter quelque chose à cette heure-là.",
      "Ce qui a eu lieu compte tout seul. Pas eu lieu ? Retire la ligne.",
    ],
  },
  valider: {
    id: "valider",
    titre: "Ce qui a compté",
    points: [
      "Ce qui a eu lieu compte tout seul. Pas eu lieu ? Retire la ligne.",
      "Une séance compte dans ton mois et dans ce que le client te doit.",
      "Un cours à plusieurs : tout le monde compte. Ouvre la séance pour retirer un absent.",
    ],
  },
  chevaux: {
    id: "chevaux",
    titre: "Ce que chaque cheval te laisse",
    points: [
      "Pour chaque cheval : ce qu’on te paie pour lui, moins ses soins, moins sa part des frais communs (foin, paille, loyer…).",
      "Le signe le dit : + il te laisse de l’argent, − il t’en coûte.",
      "Passe sur « Clients » pour voir qui te doit encore.",
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
      "Plus bas : tes séances de la semaine, des pistes pour gagner plus. Qui te doit quoi, c’est dans Clients.",
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
      "En haut, ceux qui te doivent le plus. Touche un nom pour ouvrir sa fiche.",
      "Un nom noté dans une séance devient un client tout seul.",
      "Passe sur « Chevaux » pour voir ce que chaque cheval te laisse.",
    ],
  },
  client: {
    id: "client",
    titre: "La fiche d’un client",
    points: [
      "« Hugo te doit 114 € » : ce qu’il te doit, tout compris.",
      "Il a payé ? Touche « Il a payé ». Une partie seulement ? « Il a payé une partie ».",
      "Une ligne qui n’a pas eu lieu ? Retire-la avec ×.",
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
      "Le nom de ton écurie, ton équipe, le rappel du matin.",
      "Tes chiffres restent sur ton téléphone, chiffrés. Tu peux en garder une copie.",
    ],
  },
};

/** L'aide d'un écran, d'après son adresse (« /argent?vue=… » compte comme « argent »). */
export function aidePour(path: string): Aide | undefined {
  const seg = path.replace(/^\/+/, "").split(/[/?#]/)[0];
  return AIDES[seg];
}

/** Une aide par son nom (l'onglet visible d'un écran à deux vues). */
export function aideParId(id: string): Aide | undefined {
  return AIDES[id];
}
