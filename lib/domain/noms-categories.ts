/**
 * Les noms de catégories tels qu'on les lit à l'écran. Certains noms sont
 * enregistrés sous un ancien mot (« Personnel », « Litière ») ou servent de
 * repère au calcul (« Refacturation », « Frais communs ») : on ne les renomme
 * pas dans les données, on les affiche avec les mots du gérant. Domaine pur.
 */

const cle = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'");

const AFFICHES: Record<string, string> = {
  "frais communs": "Frais de l’écurie",
  "frais fixes": "Frais de l’écurie",
  refacturation: "À faire payer au propriétaire",
  personnel: "Salaires",
  litiere: "Paille et litière",
  "loyer / foncier": "Loyer",
  "veterinaire et marechal non refactures": "Véto et maréchal payés par l’écurie",
};

/** Le nom affiché d'une catégorie (ou d'une ligne qui porte son nom). Un nom inconnu reste tel quel. */
export function nomAffiche(nom: string): string {
  return AFFICHES[cle(nom)] ?? nom;
}

/**
 * Le démonstratif de chaque poste connu, pour une question qui le cite :
 * « Cette eau », « Cet entretien », « Ces salaires ». Le verbe suit
 * (`pluriel`). Un nom qui n'est pas ici reçoit la formule neutre.
 */
const DEMONSTRATIFS: Record<string, { dit: string; pluriel?: boolean }> = {
  foin: { dit: "Ce foin" },
  paille: { dit: "Cette paille" },
  litiere: { dit: "Cette litière" },
  "paille et litiere": { dit: "Cette paille et cette litière", pluriel: true },
  granules: { dit: "Ces granulés", pluriel: true },
  aliment: { dit: "Cet aliment" },
  aliments: { dit: "Ces aliments", pluriel: true },
  personnel: { dit: "Ces salaires", pluriel: true },
  salaires: { dit: "Ces salaires", pluriel: true },
  salaire: { dit: "Ce salaire" },
  loyer: { dit: "Ce loyer" },
  "loyer / foncier": { dit: "Ce loyer" },
  eau: { dit: "Cette eau" },
  electricite: { dit: "Cette électricité" },
  assurance: { dit: "Cette assurance" },
  assurances: { dit: "Ces assurances", pluriel: true },
  entretien: { dit: "Cet entretien" },
  fournitures: { dit: "Ces fournitures", pluriel: true },
  carburant: { dit: "Ce carburant" },
  "carburant et tracteur": { dit: "Ce carburant et ce tracteur", pluriel: true },
  copeaux: { dit: "Ces copeaux", pluriel: true },
  "remboursement d'emprunt": { dit: "Ce remboursement d’emprunt" },
  emprunt: { dit: "Cet emprunt" },
  gaz: { dit: "Ce gaz" },
};

/** « Cette eau », « Ces salaires » pour un poste connu ; rien pour un nom inconnu. */
export function demonstratif(nom: string): { dit: string; pluriel: boolean } | undefined {
  const d = DEMONSTRATIFS[cle(nom)];
  return d && { dit: d.dit, pluriel: !!d.pluriel };
}
