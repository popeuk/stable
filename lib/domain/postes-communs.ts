import type { Category } from "@/lib/domain/types";

/**
 * Les postes de frais communs ajoutés après coup (octobre 2026) : ceux que les
 * gérants cherchaient sans les trouver. Partagés entre les chevaux comme les
 * autres frais communs. L'ordre donne leur identifiant fixe (`exp-s-10`…),
 * à la suite des dix premiers postes.
 */
export const POSTES_AJOUTES = [
  "Remboursement d’emprunt",
  "MSA (cotisations sociales)",
  "Carburant et tracteur",
  "Vétérinaire et maréchal non refacturés",
] as const;

/** Le premier numéro libre après les postes d'origine (exp-s-0 à exp-s-9). */
export const PREMIER_POSTE_AJOUTE = 10;

/** Monte de 1 à chaque nouvelle liste : une écurie déjà enregistrée reçoit les postes une seule fois. */
export const POSTES_VERSION = 1;

const cle = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'")
    .trim();

/**
 * Ajoute à une écurie existante les postes qui lui manquent, sans toucher à
 * ses catégories ni à ses données : un poste déjà là (même nom, accents et
 * apostrophes mis à part) n'est pas doublé. Rend la même liste si rien ne manque.
 */
export function ajouterPostesManquants(cats: Category[]): Category[] {
  const noms = new Set(cats.map((c) => cle(c.name)));
  const ids = new Set(cats.map((c) => c.id));
  const manquants: Category[] = [];
  POSTES_AJOUTES.forEach((name, i) => {
    if (noms.has(cle(name))) return;
    let id = `exp-s-${PREMIER_POSTE_AJOUTE + i}`;
    if (ids.has(id)) id = `exp-s-poste-${PREMIER_POSTE_AJOUTE + i}`;
    ids.add(id);
    manquants.push({ id, name, isDirect: false });
  });
  return manquants.length ? [...cats, ...manquants] : cats;
}
