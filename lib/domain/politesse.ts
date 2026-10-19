/**
 * Tu ou vous dans les messages envoyés aux clients (décision 2 du 18 octobre) :
 * choisi une fois dans Tes factures, « vous » tant que rien n'est choisi.
 * Et la signature : le prénom du gérant et le nom de l'écurie. Domaine pur.
 */

/** Les mots qui changent entre tu et vous. */
export interface Formule {
  /** « ta » / « votre » */
  ta: string;
  /** « te » / « vous » (« Je te joins ») */
  te: string;
  /** « tu me dois » / « vous me devez » */
  doit: string;
}
export const formule = (tu: boolean | undefined): Formule => (tu ? { ta: "ta", te: "te", doit: "tu me dois" } : { ta: "votre", te: "vous", doit: "vous me devez" });

/** Le nom générique donné à une écurie sans nom : il ne signe pas un message. */
const SANS_NOM = /^mon [ée]curie$/i;

/** Le nom de l'écurie pour signer : son nom s'il est choisi, sinon le nom de facturation. */
export function nomEcurie(stableName: string | undefined, legalName?: string): string {
  const n = (stableName ?? "").trim();
  if (n && !SANS_NOM.test(n)) return n;
  return (legalName ?? "").trim();
}

/** « Merci, » puis le prénom du gérant et le nom de l'écurie, chacun sur sa ligne. */
export function signature(gerant: string | undefined, ecurie: string | undefined): string[] {
  const qui = [(gerant ?? "").trim(), (ecurie ?? "").trim()].filter(Boolean);
  // Le prénom du gérant est souvent le même mot que l'écurie (« Claire », « Écurie Claire ») : pas de doublon exact.
  const uniques = qui.filter((x, i) => qui.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);
  return uniques.length ? ["Merci,", ...uniques] : ["Merci."];
}

/** Les formes de société et les mots d'une structure : on ne les salue pas comme un prénom. */
const STRUCTURE = /^(earl|scea|gaec|sarl|sas|sasu|eurl|sa|sci|snc|ei|eirl|selarl|scop|asso|association|haras|[ée]curies?|centre|club|poney-club|ferme|domaine|soci[ée]t[ée]|ets|[ée]tablissements|mairie|commune|lyc[ée]e|[ée]cole|cabinet|clinique|groupe|elevage|[ée]levage)$/i;
/** Les civilités : « M. Dupont » se dit en entier. */
const CIVILITE = /^(m\.?|mr\.?|mme\.?|mlle\.?|madame|monsieur|mademoiselle|dr\.?|docteur|me\.?|ma[îi]tre)$/i;

/** Le nom est-il celui d'une structure (« EARL du Haras des Lys », « SCEA Martin ») ? Un sigle en capitales compte aussi. */
export function estStructure(nom: string): boolean {
  const premier = nom.trim().split(/\s+/)[0] ?? "";
  return STRUCTURE.test(premier) || (/^[A-ZÀ-Ý]{2,}$/.test(premier) && nom.trim().split(/\s+/).length > 1);
}

/**
 * Comment on appelle un client à l'écran : son prénom (« Hugo L. » → « Hugo »),
 * mais le nom entier pour une structure (« EARL du Haras des Lys ») ou une
 * civilité (« M. Dupont »), jamais « EARL » ni « M. » tout seuls.
 */
export function appel(nom: string): string {
  const n = nom.trim();
  const premier = n.split(/\s+/)[0] ?? "";
  if (!premier) return nom;
  if (estStructure(n) || CIVILITE.test(premier)) return n;
  return premier;
}

/** « Bonjour Claire, », « Bonjour M. Dupont, », et « Bonjour, » pour une structure. */
export function salut(nom: string): string {
  const n = nom.trim();
  if (!n || estStructure(n)) return "Bonjour,";
  return `Bonjour ${appel(n)},`;
}

