import { Children, type ReactNode } from "react";

/**
 * La typographie française des textes affichés : une espace fine insécable
 * (U+202F) avant « ? », « ! » et « ; », une insécable (U+00A0) avant « : »,
 * dans les guillemets « … » et entre un nombre et « € » ou « % ». Sur un
 * téléphone de 375 px, « Qui était là ? » ne laisse plus son « ? » seul en
 * début de ligne.
 *
 * Sûre pour les montants déjà passés par formatEur (ils ont déjà leurs
 * insécables, rien ne change), pour les heures (« 9:00 », sans espace), les
 * adresses (« https:// ») et le HTML des messages (les balises n'ont pas
 * d'espace avant ces signes). Appeler deux fois ne change rien de plus.
 */
const FINE = " ";
const NB = " ";

export function fr(s: string): string {
  if (!s) return s;
  return s
    .replace(/[  ]+([?!;])/g, `${FINE}$1`)
    .replace(/ +:(?=\s|$|<)/g, `${NB}:`)
    .replace(/« +/g, `«${NB}`)
    .replace(/ +»/g, `${NB}»`)
    .replace(/(\d) +(€|%)/g, `$1${NB}$2`);
}

/**
 * La même chose pour ce qu'un composant reçoit en enfants : le texte direct et
 * les listes de textes ; un élément (un <b>, un lien) reste tel quel, ses
 * propres textes ne sont pas touchés.
 */
export function frNode(node: ReactNode): ReactNode {
  if (typeof node === "string") return fr(node);
  if (Array.isArray(node)) return Children.map(node, (c) => (typeof c === "string" ? fr(c) : c));
  return node;
}
