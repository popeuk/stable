/**
 * Le nombre d'écuries de mon-ecurie.fr, tel qu'on l'écrit dans l'app : lu en
 * direct sur le site (route « chiffres »), arrondi au millier du dessous
 * (« plus de 12 000 écuries »). Sans réseau ou sans chiffre : « des milliers
 * d'écuries ». Jamais un chiffre figé dans le code, qui vieillit.
 */
const nf = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/[  ]/g, " ");

export function ecuriesTexte(n?: number | null): string {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 1000) return "des milliers d’écuries";
  const bas = Math.floor(n / 1000) * 1000;
  return bas === n ? `${nf(bas)} écuries` : `plus de ${nf(bas)} écuries`;
}

/** La même chose, avec une majuscule (début de phrase). */
export function EcuriesTexte(n?: number | null): string {
  const t = ecuriesTexte(n);
  return t.charAt(0).toUpperCase() + t.slice(1);
}
