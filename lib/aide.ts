/**
 * « Comment ça marche ici » : pour chaque écran, ce qu'on y voit et ce
 * qu'on peut y faire, en quelques points. À la première visite, rien ne
 * s'ouvre : une seule bulle courte (`bulle`) se pose près de l'élément
 * utile et part au premier toucher. Le « ? » de l'en-tête ouvre la carte
 * complète, à la demande. Les mots sont ceux du gérant, jamais ceux du code.
 */
/** Où se pose la bulle : au-dessus du +, ou sous l'en-tête, pointe vers le « ? ». */
export type CibleBulle = "plus" | "haut";
export interface Aide {
  id: string;
  titre: string;
  points: string[];
  /** La bulle de la première visite : une phrase de 4 à 9 mots. */
  bulle: string;
  cible: CibleBulle;
}

const AIDES: Record<string, Aide> = {
  accueil: {
    id: "accueil",
    titre: "Ton accueil, chaque matin",
    bulle: "Tout ce que tu fais, tu le notes ici",
    cible: "plus",
    points: [
      "En haut, ce qu’il te reste ce mois, une fois tout payé. Touche-le pour voir d’où ça vient.",
      "Ta journée : les séances, les soins et les tâches prévus aujourd’hui.",
      "Ce qui était prévu est compté fait. Pas eu lieu ? Retire la ligne.",
      "Le + en bas sert à tout ajouter : une séance, un soin, une tâche, de l’argent.",
    ],
  },
  planning: {
    id: "planning",
    titre: "Ton planning",
    bulle: "Touche un jour pour voir sa journée",
    cible: "haut",
    points: [
      "Tout ce qui est prévu, jour par jour : séances, soins, tâches.",
      "Sous les jours, un résumé de la journée choisie : ce qui est fait et ce qui reste prévu.",
      "Ce qui a eu lieu compte tout seul. Pas eu lieu ? Retire la ligne.",
      "En bas, les tâches de l’équipe.",
    ],
  },
  valider: {
    id: "valider",
    titre: "Ce qui est fait",
    bulle: "Pas eu lieu ? Retire la ligne",
    cible: "haut",
    points: [
      "Ce qui a eu lieu compte tout seul. Pas eu lieu ? Retire la ligne.",
      "Une séance faite compte dans ton bilan et dans ce que le client te doit.",
      "Un cours à plusieurs : chaque cavalier compte. Ouvre la séance pour retirer un absent.",
    ],
  },
  chevaux: {
    id: "chevaux",
    titre: "Ce que chaque cheval te laisse",
    bulle: "Touche un cheval pour voir ce qu’il te laisse",
    cible: "haut",
    points: [
      "Pour chaque cheval : ce qu’on te paie, moins ses soins et sa part des frais de l’écurie (foin, paille, loyer…).",
      "Le signe te le dit : + il te laisse de l’argent, − il t’en coûte.",
      "Passe sur « Clients » pour voir qui te doit encore.",
    ],
  },
  ticket: {
    id: "ticket",
    titre: "La fiche du cheval",
    bulle: "Un soin pour lui ? Note-le avec le +",
    cible: "plus",
    points: [
      "En haut, ce qu’on te paie pour lui. En dessous, ce qu’il coûte. Tout en bas, ce qu’il te laisse.",
      "Sa part des frais, c’est son morceau du foin, de la paille, du loyer… de tout ce qui sert à l’écurie.",
      "Son carnet garde ses soins et ce qui arrive bientôt : vermifuge, maréchal, vaccins.",
    ],
  },
  argent: {
    id: "argent",
    titre: "Mon bilan",
    bulle: "Ce qu’il te reste, tout payé",
    cible: "haut",
    points: [
      "Ce qui est rentré, ce qui est sorti, et ce qu’il te reste.",
      "Il se remplit tout seul avec ce que tu notes : pensions, séances, soins, dépenses. Pas besoin de faire les comptes.",
      "Plus bas : tes séances de la semaine et des idées pour gagner plus. Qui te doit quoi, c’est dans Clients.",
    ],
  },
  pilotage: {
    id: "pilotage",
    titre: "Sur plusieurs mois",
    bulle: "Tes chiffres, mois après mois",
    cible: "haut",
    points: [
      "Les mêmes chiffres que dans Mon bilan, sur 3, 6 ou 12 mois.",
      "Pour voir si ça s’améliore, et ce qui pèse le plus.",
    ],
  },
  seuil: {
    id: "seuil",
    titre: "Combien de chevaux pour ne pas perdre d’argent",
    bulle: "Le calcul est dans « Comment on le sait ? »",
    cible: "haut",
    points: [
      "Les frais de l’écurie (foin, loyer, salaires…) tombent chaque mois, quel que soit le nombre de chevaux.",
      "Ce chiffre te dit combien de chevaux il te faut pour les payer.",
    ],
  },
  scenarios: {
    id: "scenarios",
    titre: "Et si… ?",
    bulle: "Essaie, tes vrais chiffres ne bougent pas",
    cible: "haut",
    points: [
      "Essaie un changement, une pension plus chère ou un cheval en plus, et regarde ce que ça donnerait.",
      "Rien ne change dans tes vrais chiffres.",
    ],
  },
  depenses: {
    id: "depenses",
    titre: "Ce qui rentre et ce qui sort",
    bulle: "Une dépense ? Note-la avec le +",
    cible: "plus",
    points: [
      "Tout ce que tu as payé ce mois.",
      "Une dépense pour un cheval va sur sa fiche. Les frais de l’écurie (foin, loyer…) se partagent entre tous.",
    ],
  },
  equipe: {
    id: "equipe",
    titre: "Les tâches de l’équipe",
    bulle: "Ajoute une tâche, confie-la à quelqu’un",
    cible: "haut",
    points: [
      "Ce qu’il y a à faire à l’écurie, et qui s’en occupe.",
      "Ajoute une tâche, confie-la à quelqu’un, puis coche-la quand elle est faite.",
    ],
  },
  clients: {
    id: "clients",
    titre: "Tes clients",
    bulle: "Touche un nom pour voir ce qu’il te doit",
    cible: "haut",
    points: [
      "Les propriétaires des chevaux en pension et les cavaliers qui prennent des cours.",
      "En haut, ceux qui te doivent le plus. Touche un nom pour ouvrir sa fiche.",
      "Un nom noté dans une séance devient un client tout seul.",
      "Va dans « Chevaux » pour voir ce que chaque cheval te laisse.",
    ],
  },
  client: {
    id: "client",
    titre: "La fiche d’un client",
    bulle: "Un paiement ? Touche le bouton sous la somme",
    cible: "haut",
    points: [
      "« Hugo te doit 114 € » : ce qu’il te doit, tout compris.",
      "Il a payé ? Touche « Il a payé ». Juste une partie ? « Il a payé une partie ».",
      "Une ligne qui n’a pas eu lieu ? Retire-la avec ×.",
    ],
  },
  prestations: {
    id: "prestations",
    titre: "Tes prix",
    bulle: "Ces prix se mettent tout seuls dans tes séances",
    cible: "haut",
    points: [
      "Pension, cours, balades… avec leur prix.",
      "Quand tu notes une séance, son prix se met tout seul.",
      "Tu vois aussi ce que chaque cours t’a rapporté ce mois-ci.",
    ],
  },
  "ma-fiche": {
    id: "ma-fiche",
    titre: "Ta fiche sur mon-ecurie.fr",
    bulle: "Ta fiche, comme la voient les cavaliers",
    cible: "haut",
    points: [
      "mon-ecurie.fr, c’est l’annuaire où les cavaliers cherchent une pension pour leur cheval.",
      "Places libres, prix, photos, présentation : une fois ta fiche validée, ce que tu changes ici apparaît sur l’annuaire.",
      "C’est gratuit, et aucune commission n’est prise sur tes pensions.",
    ],
  },
  moi: {
    id: "moi",
    titre: "Réglages",
    bulle: "Ton compte, ton rappel, l’affichage",
    cible: "haut",
    points: [
      "Mon écurie garde l’écurie : places, papiers, équipe. Réglages garde l’app : compte, rappel, affichage.",
      "Tes chiffres sont sur ce téléphone et, avec un compte, dans ta copie en ligne, protégée. Tu peux aussi faire une sauvegarde.",
    ],
  },
};

/**
 * L'aide d'un écran, d'après son adresse (« /argent?vue=… » compte comme
 * « argent »). L'écran Clients a deux onglets : « /chevaux » ouvre Clients
 * (son aide à lui), « /chevaux?vue=chevaux » ouvre Chevaux.
 */
export function aidePour(path: string): Aide | undefined {
  const seg = path.replace(/^\/+/, "").split(/[/?#]/)[0];
  if (seg === "chevaux") return /[?&]vue=chevaux\b/.test(path) ? AIDES.chevaux : AIDES.clients;
  return AIDES[seg];
}

/** Une aide par son nom (l'onglet visible d'un écran à deux vues). */
export function aideParId(id: string): Aide | undefined {
  return AIDES[id];
}

/**
 * La bulle à montrer à l'arrivée sur un écran : seulement si l'écran a une
 * aide et que le gérant ne l'a pas encore vue (même mémoire que la carte,
 * `aidesVues`), et jamais quand la carte est déjà ouverte.
 */
export function bulleAMontrer(aide: Aide | undefined, vues: readonly string[], carteOuverte: string | null = null): { id: string; texte: string; cible: CibleBulle } | null {
  if (!aide || vues.includes(aide.id) || carteOuverte === aide.id) return null;
  return { id: aide.id, texte: aide.bulle, cible: aide.cible };
}

/**
 * Où poser la bulle autour de sa cible (rectangle à l'écran) : au-dessus si
 * la cible est dans le bas de l'écran (le +), sinon dessous (le « ? »).
 * Jamais hors de l'écran : 16 px de marge ; la pointe reste sous la cible.
 */
export function placerBulle(
  cible: { top: number; bottom: number; left: number; width: number },
  bulle: { width: number },
  ecran: { width: number; height: number },
  ecart = 10,
  marge = 16,
): { left: number; top?: number; bottom?: number; pointe: number; dessus: boolean } {
  const cx = cible.left + cible.width / 2;
  const w = Math.min(bulle.width, ecran.width - 2 * marge);
  const left = Math.round(Math.max(marge, Math.min(ecran.width - marge - w, cx - w / 2)));
  const pointe = Math.round(Math.max(14, Math.min(w - 14, cx - left)));
  const dessus = cible.top > ecran.height / 2;
  return dessus ? { left, bottom: Math.round(ecran.height - cible.top + ecart), pointe, dessus } : { left, top: Math.round(cible.bottom + ecart), pointe, dessus };
}
