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
