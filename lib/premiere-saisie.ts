import type { StableData } from "@/lib/domain/types";

/**
 * La première vraie saisie du gérant : une séance, un soin, une tâche, une
 * dépense, un paiement, un cheval renommé… ajoutés en utilisant l'app, après
 * le parcours de départ. Le parcours, lui, ne pose que des chevaux, des prix
 * et les frais de l'écurie ; l'autopilote ne poste que des pensions (source
 * « recurring »). Aucun nouveau champ : tout se lit dans le carnet.
 */
type Carnet = Pick<StableData, "horses" | "revenues" | "directExpenses" | "sharedExpenses"> &
  Partial<Pick<StableData, "seances" | "payments" | "tasks" | "careEvents" | "rhythms" | "recurringExpenses" | "recurringRevenues">>;

const n = (a?: unknown[]) => a?.length ?? 0;

/**
 * Ce que seul l'usage de l'app produit : le parcours n'en crée jamais. Sert
 * aussi pour une écurie déjà utilisée avant que le bandeau attende la
 * première saisie.
 */
export function aDejaSaisi(d: Carnet): boolean {
  return (
    n(d.seances) > 0 ||
    n(d.payments) > 0 ||
    n(d.tasks) > 0 ||
    n(d.careEvents) > 0 ||
    n(d.rhythms) > 0 ||
    n(d.directExpenses) > 0 ||
    (d.revenues ?? []).some((r) => r.source !== "recurring")
  );
}

/**
 * Entre deux états du carnet, dans l'app (le parcours vit hors de la coque) :
 * le gérant vient-il d'ajouter ou de changer quelque chose ? Un carnet
 * remplacé en entier (nouvelle écurie, chargement) ne compte pas.
 */
export function nouvelleSaisie(avant: Carnet, apres: Carnet): boolean {
  const idsAvant = new Set(avant.horses.map((h) => h.id));
  const remplace = avant.horses.length > 0 && apres.horses.length > 0 && !apres.horses.some((h) => idsAvant.has(h.id));
  if (remplace) return false;
  if (!aDejaSaisi(avant) && aDejaSaisi(apres)) return true;
  // Un cheval ajouté, renommé, ou qui reçoit son propriétaire.
  const parId = new Map(avant.horses.map((h) => [h.id, h]));
  if (apres.horses.some((h) => !parId.has(h.id))) return true;
  if (apres.horses.some((h) => {
    const a = parId.get(h.id);
    return !!a && (a.name !== h.name || (a.ownerName ?? "") !== (h.ownerName ?? ""));
  }))
    return true;
  // Une dépense de l'écurie ou une recette qui revient, notée dans l'app.
  return n(apres.sharedExpenses) > n(avant.sharedExpenses) || n(apres.recurringExpenses) > n(avant.recurringExpenses) || n(apres.recurringRevenues) > n(avant.recurringRevenues);
}
