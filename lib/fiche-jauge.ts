import type { Fiche } from "@/lib/account/api";

/**
 * La jauge de la fiche (décision du 27 octobre 2026) : dix informations, dans
 * l'ordre de ce que les cavaliers regardent avant d'écrire. Elle se lit sur
 * l'accueil (« n sur 10 »), dans Vitrine et sur le compteur de l'onglet.
 *
 * Les horaires d'accès ne comptent que si le site les renvoie (champ
 * « horaires », à ajouter à l'API de pc-bestable) : d'ici là, la jauge est
 * sur 9, pour ne jamais réclamer une information qu'on ne sait pas enregistrer.
 */
export type InfoFiche = "places" | "prix" | "hebergement" | "photos" | "installations" | "services" | "activites" | "presentation" | "contact" | "horaires";

export interface Info {
  k: InfoFiche;
  t: string;
  ok: boolean;
}

/** Une présentation est complète à partir de 120 signes (même seuil que « Ma fiche »). */
export const PRESENTATION_MIN = 120;

type FicheJauge = Pick<Fiche, "places_libres" | "prix_min" | "formules" | "hebergement" | "photos" | "installations" | "services" | "offres" | "description" | "telephone" | "email"> & { horaires?: string };

export function infosFiche(f: FicheJauge): Info[] {
  const l: Info[] = [
    { k: "places", t: "Places libres", ok: f.places_libres !== "" && f.places_libres != null },
    { k: "prix", t: "Prix de la pension", ok: !!f.prix_min || f.formules.some((x) => !!x.prix) },
    { k: "hebergement", t: "Hébergement", ok: f.hebergement.length > 0 },
    { k: "photos", t: "Photos", ok: f.photos.length >= 3 },
    { k: "installations", t: "Installations", ok: f.installations.length > 0 },
    { k: "services", t: "Services", ok: f.services.length > 0 },
    { k: "activites", t: "Activités", ok: f.offres.length > 0 },
    { k: "presentation", t: "Présentation", ok: f.description.trim().length >= PRESENTATION_MIN },
    { k: "contact", t: "Téléphone ou e-mail", ok: !!f.telephone.trim() || !!f.email.trim() },
  ];
  if (typeof f.horaires === "string") l.push({ k: "horaires", t: "Horaires d’accès", ok: !!f.horaires.trim() });
  return l;
}

export function jaugeFiche(f: FicheJauge): { n: number; total: number; manque: Info[] } {
  const l = infosFiche(f);
  return { n: l.filter((i) => i.ok).length, total: l.length, manque: l.filter((i) => !i.ok) };
}

/** « places libres, prix de la pension et photos » : ce qui manque, dit en une phrase. */
export function direManque(manque: Info[], max = 4): string {
  const noms = manque.slice(0, max).map((i) => i.t.toLowerCase());
  const reste = manque.length - noms.length;
  if (reste > 0) noms.push(`${reste} autre${reste > 1 ? "s" : ""}`);
  return noms.length < 2 ? noms.join("") : `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}
