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

/** « Merci, » (ou « Bonne journée, » pour un remboursement) puis le prénom du gérant et le nom de l'écurie, chacun sur sa ligne. */
export function signature(gerant: string | undefined, ecurie: string | undefined, rembourse?: boolean): string[] {
  const qui = [(gerant ?? "").trim(), (ecurie ?? "").trim()].filter(Boolean);
  // Le prénom du gérant est souvent le même mot que l'écurie (« Claire », « Écurie Claire ») : pas de doublon exact.
  const uniques = qui.filter((x, i) => qui.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);
  const formule = rembourse ? "Bonne journée" : "Merci";
  return uniques.length ? [`${formule},`, ...uniques] : [`${formule}.`];
}

/** Les formes de société et les mots d'une structure : on ne les salue pas comme un prénom. */
const STRUCTURE = /^(earl|scea|gaec|sarl|sas|sasu|eurl|sa|sca|sci|snc|ei|eirl|selarl|scop|ste|st[ée]|asso|association|haras|[ée]curies?|centre|club|poney-club|ferme|domaine|soci[ée]t[ée]|ets|[ée]tablissements|mairie|commune|lyc[ée]e|[ée]cole|cabinet|clinique|groupe|[ée]levage)$/i;
/** Les civilités : « M. Dupont » n'est pas un prénom. */
/** Les particules et articles qui ouvrent un nom écrit à l'endroit ou à l'envers (« de Villiers », « Le Haras », « d'Aubigny ») : pas un prénom. */
const PARTICULE = /^(de|du|des|d['’].*|le|la|les|l['’].*)$/i;
const CIVILITE = /^(m\.?|mr\.?|mme\.?|mlle\.?|madame|monsieur|mademoiselle|dr\.?|docteur|me\.?|ma[îi]tre)$/i;

/** Ce premier mot est-il une civilité ou une forme de société (« M. », « EARL », « Haras ») ? */
export const pasUnPrenom = (mot: string) => STRUCTURE.test(mot) || CIVILITE.test(mot) || PARTICULE.test(mot);

/**
 * On ne tutoie qu'une personne : une société, une association, un client
 * professionnel ou une civilité (« M. Dupont ») reçoivent toujours le vous,
 * quel que soit le réglage général.
 */
export function peutTutoyer(tu: boolean | undefined, nom: string | undefined, pro?: boolean): boolean {
  if (!tu || pro) return false;
  const n = (nom ?? "").trim();
  return !estStructure(n) && !CIVILITE.test(n.split(/\s+/)[0] ?? "");
}

/** Le nom est-il celui d'une structure (« EARL du Haras des Lys », « SCEA Martin ») ? Un sigle en capitales compte aussi. */
export function estStructure(nom: string): boolean {
  const premier = nom.trim().split(/\s+/)[0] ?? "";
  return STRUCTURE.test(premier) || (/^[A-ZÀ-Ý]{2,}$/.test(premier) && nom.trim().split(/\s+/).length > 1);
}

/**
 * La seule règle du prénom d'un client (messages, écrans, factures, relances) :
 * le premier mot quand le client est une personne (« Hugo L. » → « Hugo »),
 * rien pour un professionnel, une société (« EARL… », « SCEA… », un sigle en
 * capitales), une civilité (« M. Dupont », « Mme Leroy ») ou une initiale
 * (« C. Dubois »).
 */
export function prenom(nom: string | undefined, pro?: boolean): string {
  if (pro) return "";
  const premier = (nom ?? "").trim().split(/\s+/)[0] ?? "";
  const lettres = premier.replace(/[^\p{L}]/gu, "");
  if (!premier || premier.endsWith(".") || pasUnPrenom(premier) || lettres.length < 2 || lettres === lettres.toUpperCase()) return "";
  return premier;
}

/**
 * Comment on appelle un client à l'écran : son prénom (« Hugo L. » → « Hugo »),
 * sinon le nom en entier (« EARL du Haras des Lys », « M. Dupont »), jamais
 * « EARL » ni « M. » tout seuls.
 */
export function appel(nom: string, pro?: boolean): string {
  return prenom(nom, pro) || nom.trim() || nom;
}

/** « Bonjour Claire, » pour une personne ; « Bonjour, » pour un pro, une société, une civilité, une initiale. */
export function salut(nom: string | undefined, pro?: boolean): string {
  const p = prenom(nom, pro);
  return p ? `Bonjour ${p},` : "Bonjour,";
}
