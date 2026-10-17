import type { Category, StableData } from "@/lib/domain/types";

/**
 * Les catégories dont l'app dépend pour compter toute seule : la pension
 * (l'autopilote poste chaque mois la pension des chevaux sous ce nom, et la
 * facture la range en « Pension »), les cours (les séances faites), la
 * refacturation (un frais payé par le propriétaire) et les frais fixes du
 * parcours. On peut les garder sans s'en servir ; on ne peut pas les
 * retirer, sinon des pensions cesseraient d'être comptées sans rien dire.
 * Domaine pur.
 */
export const RECETTES_SYSTEME = [
  { name: "Pension", id: "rev-0", why: "les pensions de chaque mois se comptent toutes seules sous ce nom" },
  { name: "Cours", id: "rev-1", why: "les cours et séances faits se rangent ici" },
  { name: "Refacturation", id: "rev-7", why: "ce que tu fais payer au propriétaire se range ici" },
] as const;
export const DEPENSES_SYSTEME = [{ name: "Frais fixes", why: "le total des frais de l’écurie, noté au départ, se range ici" }] as const;

const norm = (s: string) => s.trim().toLowerCase();

/** Pourquoi cette catégorie ne se retire pas, ou rien si elle se retire. */
export function categorieSysteme(c: Pick<Category, "name">, sens: "recette" | "depense"): string | undefined {
  const list: readonly { name: string; why: string }[] = sens === "recette" ? RECETTES_SYSTEME : DEPENSES_SYSTEME;
  return list.find((x) => norm(x.name) === norm(c.name))?.why;
}

/**
 * Les catégories système retirées avant cette règle reviennent, avec leur
 * identifiant d'origine quand il est libre : les pensions déjà notées
 * retrouvent leur nom, et l'autopilote recommence à les poster.
 */
export function avecCategoriesSysteme<T extends Pick<StableData, "revenueCategories">>(d: T): T {
  const cats = Array.isArray(d.revenueCategories) ? d.revenueCategories : [];
  const manque = RECETTES_SYSTEME.filter((x) => !cats.some((c) => norm(c.name) === norm(x.name)));
  if (!manque.length) return d;
  const ids = new Set(cats.map((c) => c.id));
  const ajout = manque.map((x) => ({ id: ids.has(x.id) ? `${x.id}-${norm(x.name)}` : x.id, name: x.name }));
  return { ...d, revenueCategories: [...cats, ...ajout] };
}
