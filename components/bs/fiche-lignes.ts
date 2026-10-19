import type { Fiche } from "@/lib/account/api";

/** Ce qui est en place et ce qui manque sur une fiche : [libellé, fait, si oui, si non]. */
export function ficheRows(f: Partial<Fiche>, claimed?: boolean): [string, boolean, string, string][] {
  return [
    ["Sur la carte de l’annuaire", true, "en ligne", ""],
    ["Fiche à ton nom", !!claimed, "à ton nom", "à mettre à ton nom"],
    ["Tarifs affichés", Number(f.prix_min) > 0 || !!f.formules?.some((x) => Number(x.prix) > 0), "affichés", "à renseigner"],
    ["Places libres", f.places_libres !== "" && f.places_libres !== undefined, "à jour", "à préciser"],
    ["Photos", !!f.photos?.length, `${f.photos?.length ?? 0} photo${(f.photos?.length ?? 0) > 1 ? "s" : ""}`, "à ajouter"],
    ["Téléphone ou e-mail", !!(f.telephone || f.email), "affiché", "à ajouter"],
  ];
}
