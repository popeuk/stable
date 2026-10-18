/**
 * Les chiffres lus d'un coup d'œil : de quoi montrer la réponse plutôt que
 * l'expliquer (Mon bilan, Sur plusieurs mois, Combien de chevaux). Aucun
 * calcul d'argent ici : on lit ce que les écrans ont déjà calculé.
 */

/**
 * Le montant que tous les chevaux partagent, à l'euro près, ou null s'ils
 * diffèrent. Il faut au moins deux chevaux : un seul n'a rien à regrouper.
 */
export function montantCommun(nets: number[]): number | null {
  if (nets.length < 2) return null;
  const premier = Math.round(nets[0]);
  return nets.every((v) => Math.round(v) === premier) ? premier : null;
}

/**
 * Combien de pensions il manque pour tout payer : un nombre entier de
 * chevaux, 0 si on y est déjà, null si ce n'est pas atteignable.
 */
export function pensionsQuiManquent(seuil: number, chevaux: number): number | null {
  if (!isFinite(seuil)) return null;
  return Math.max(0, Math.ceil(seuil - 1e-9) - chevaux);
}

/**
 * « il te reste 617 € » ou « il te manque 617 € » : le verbe porte le sens,
 * le nombre se dit sans signe (« il te manque −617 € » se lisait de travers).
 * La même formule partout : accueil, Mon bilan, tournée, pastille du haut.
 */
export const resteOuManque = (net: number) => (Math.round(net) < 0 ? "il te manque" : "il te reste");

/** « Il te faut 9 pensions. » : le seuil se compte en pensions, pas en chevaux. */
export function ilFautPensions(seuil: number): string {
  const n = Math.ceil(seuil - 1e-9);
  return `Il te faut ${n} pension${n > 1 ? "s" : ""}.`;
}

/** Quand le seuil dépasse les places : même pleines, il manque (`manque` arrive écrit, « 430 € »). */
export const memePlein = (places: number, manque: string) => `Même avec tes ${places} places pleines, il manque environ ${manque} par mois.`;
export const REVOIR_PRIX = "C’est le prix des pensions qu’il faut revoir.";

/** La phrase sous « Il te faut 9 pensions. Tu en as 9. » : la réponse, sans le calcul. */
export function phraseSeuil(seuil: number, chevaux: number): string {
  const manque = pensionsQuiManquent(seuil, chevaux);
  if (manque === null) return "Pour l’instant, les pensions ne paient même pas les soins des chevaux.";
  if (manque === 0 && chevaux === 0) return "Tout est payé.";
  if (manque === 0) return `Avec ${chevaux} pension${chevaux > 1 ? "s" : ""}, tout est payé.`;
  return `Il te manque ${manque} pension${manque > 1 ? "s" : ""} pour tout payer.`;
}

/**
 * La barre du mois en cours : du 1er au dernier jour, remplie jusqu'à
 * aujourd'hui (date locale AAAA-MM-JJ).
 */
export function barreDuMois(aujourdhui: string) {
  const y = Number(aujourdhui.slice(0, 4));
  const m = Number(aujourdhui.slice(5, 7));
  const jour = Number(aujourdhui.slice(8, 10));
  const dernier = new Date(y, m, 0).getDate();
  const restant = dernier - jour;
  const court = (d: number) => new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const long = new Date(y, m - 1, jour).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  return {
    pct: (jour / dernier) * 100,
    debut: court(1),
    fin: court(dernier),
    aria: restant > 0 ? `${long}, encore ${restant} jour${restant > 1 ? "s" : ""} dans le mois` : `${long}, dernier jour du mois`,
  };
}
