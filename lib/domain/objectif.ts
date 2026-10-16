/**
 * L'objectif du mois : ce que le gérant veut qu'il lui reste une fois tout
 * payé. 0 veut dire « pas d'objectif » : c'est le cas d'une écurie neuve
 * tant que le gérant n'en a pas posé un. Sans objectif, l'app ne parle ni de
 * manque, ni de pourcentage, ni d'objectif atteint. Domaine pur.
 */
const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const eur = (n: number) => `${nf0.format(Math.round(n)).replace(/ /g, " ")} €`;

export const hasObjective = (objective: number) => Number.isFinite(objective) && objective > 0;

/** Ce qu'il manque pour l'atteindre (0 s'il est atteint), ou null sans objectif. */
export function objectifManque(net: number, objective: number): number | null {
  if (!hasObjective(objective)) return null;
  return Math.max(0, objective - net);
}

/** Le chemin parcouru, de 0 à 100, ou null sans objectif. */
export function objectifPct(net: number, objective: number): number | null {
  if (!hasObjective(objective)) return null;
  return Math.max(0, Math.min(100, (net / objective) * 100));
}

/**
 * « Il te manque 448 € pour ton objectif de 1 000 €. » Sans objectif, rien :
 * l'interface propose elle-même de s'en fixer un (« Te fixer un objectif
 * pour le mois ? »), jamais un manque.
 */
export function phraseObjectif(net: number, objective: number): string {
  const left = objectifManque(net, objective);
  if (left === null) return "";
  return left > 0 ? `Il te manque ${eur(left)} pour ton objectif de ${eur(objective)}.` : `Objectif de ${eur(objective)} atteint.`;
}

/** La suite de « il te reste X € » dans Mon mois, ou une chaîne vide sans objectif. */
export function phraseObjectifMois(net: number, objective: number, enCours: boolean): string {
  const left = objectifManque(net, objective);
  if (left === null) return "";
  if (!enCours) return `Ton objectif : ${eur(objective)}.`;
  return left > 0 ? `Encore ${eur(left)} et tu atteins les ${eur(objective)} que tu vises.` : `Tu as atteint les ${eur(objective)} que tu vises.`;
}

/** L'en-tête des pistes : le manque n'apparaît que s'il y a un objectif. */
export function phrasePistes(net: number, objective: number): string {
  const left = objectifManque(net, objective);
  if (left === null) return "Avec ces pistes, jusqu’à";
  return left > 0 ? `Il te manque ${eur(left)} pour ton objectif. Avec ces pistes, jusqu’à` : "Objectif atteint. Avec ces pistes, encore jusqu’à";
}
