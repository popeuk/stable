/**
 * Arrondir au centime, le plus proche (0,005 € monte). Le seul arrondi
 * d'argent de l'app : chaque total, chaque reste, chaque part passe par lui.
 */
export const r2 = (n: number): number => Math.round(n * 100) / 100;
