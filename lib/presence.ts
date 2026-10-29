import type { DemandeCavalier, Fiche } from "@/lib/account/api";
import { PRESENTATION_MIN } from "@/lib/fiche-jauge";

/**
 * L'audit de la présence en ligne (29 octobre 2026, maquette validée par Samuel) :
 * ce qu'un cavalier trouve sur l'écurie, rangé en trois étapes (il te trouve,
 * il te choisit, il t'écrit). Chaque point dit ce qu'on a vu et où, pourquoi ça
 * compte, et quelle partie de la Vitrine le corrige.
 *
 * Première version : on ne lit que ce que l'app sait déjà (la fiche bestable.fr
 * et les demandes). Google, le site et Facebook viendront ensuite ; on ne juge
 * jamais une source qu'on n'a pas lue.
 */

export type EtatPoint = "ko" | "mid" | "ok";
export type EtapeId = 1 | 2 | 3;
/** Les parties de la Vitrine, ouvertes en fenêtre. */
export type Partie = "places" | "propose" | "contact" | "photos";

export interface Vu {
  ou: string;
  valeur: string;
  mauvais?: boolean;
}
export interface Point {
  id: string;
  etat: EtatPoint;
  titre: string;
  vu: Vu[];
  pourquoi: string;
  action?: { label: string; partie: Partie };
}
export interface Etape {
  id: EtapeId;
  titre: string;
  /** Ce que fait le cavalier à cette étape, en une ligne. */
  scene: string;
  etat: EtatPoint;
  verdict: string;
  points: Point[];
}

type FicheAudit = Pick<Fiche, "en_attente" | "adresse" | "commune" | "code_postal" | "site" | "places_libres" | "places_maj" | "prix_min" | "formules" | "photos" | "description" | "hebergement" | "installations" | "services" | "telephone" | "email">;
type DemandeAudit = Pick<DemandeCavalier, "id" | "date" | "reponses">;

const FICHE = "Ta fiche bestable.fr";
const JOUR = 86_400_000;

/** Les places datent de plus de 30 jours : elles méritent d'être confirmées. */
function placesAnciennes(maj: string | undefined, maintenant: Date): boolean {
  if (!maj) return false;
  return maintenant.getTime() - new Date(maj + "T12:00:00").getTime() > 30 * JOUR;
}

const pire = (l: EtatPoint[]): EtatPoint => (l.includes("ko") ? "ko" : l.includes("mid") ? "mid" : "ok");

export function auditPresence(f: FicheAudit, demandes: DemandeAudit[] = [], repondues: number[] = [], maintenant = new Date()): Etape[] {
  // 1. Il te trouve
  const trouve: Point[] = [];
  trouve.push(
    f.en_attente
      ? { id: "fiche", etat: "mid", titre: "Ta fiche est en cours de vérification", vu: [{ ou: FICHE, valeur: "En vérification" }], pourquoi: "Tant qu’elle n’est pas à ton nom, ce que tu remplis attend avant d’apparaître." }
      : { id: "fiche", etat: "ok", titre: "Ta fiche est en ligne, à ton nom", vu: [{ ou: FICHE, valeur: "En ligne" }], pourquoi: "C’est elle que voit un cavalier qui cherche une pension près de chez toi sur bestable.fr." },
  );
  const adresse = !!(f.adresse.trim() && f.commune.trim() && f.code_postal.trim());
  trouve.push(
    adresse
      ? { id: "adresse", etat: "ok", titre: "Ton adresse est complète", vu: [{ ou: FICHE, valeur: f.commune }], pourquoi: "Les cavaliers cherchent par commune : une adresse juste te place au bon endroit." }
      : { id: "adresse", etat: "mid", titre: "Ton adresse est incomplète", vu: [{ ou: FICHE, valeur: "Incomplète", mauvais: true }], pourquoi: "Les cavaliers cherchent par commune. L’adresse se corrige sur ton espace bestable.fr." },
  );
  trouve.push(
    f.site.trim()
      ? { id: "site", etat: "ok", titre: "Ton site est indiqué", vu: [{ ou: FICHE, valeur: f.site.replace(/^https?:\/\//, "").replace(/\/$/, "") }], pourquoi: "Un cavalier qui veut en savoir plus te retrouve tout de suite." }
      : { id: "site", etat: "mid", titre: "Aucun site ni page indiqués", vu: [{ ou: FICHE, valeur: "Rien", mauvais: true }], pourquoi: "Un cavalier qui cherche ton nom veut en voir plus. Une page Facebook compte aussi : indique-la.", action: { label: "Indiquer mon site", partie: "contact" } },
  );

  // 2. Il te choisit
  const choisit: Point[] = [];
  const anciennes = placesAnciennes(f.places_maj, maintenant);
  if (f.places_libres === "" || f.places_libres == null)
    choisit.push({ id: "places", etat: "ko", titre: "On ne sait pas si tu as de la place", vu: [{ ou: FICHE, valeur: "Rien", mauvais: true }], pourquoi: "Sans info, il suppose que c’est plein. Même « complet » l’aide à décider.", action: { label: "Le dire, 1 minute", partie: "places" } });
  else if (anciennes)
    choisit.push({ id: "places", etat: "mid", titre: "Tes places datent de plus d’un mois", vu: [{ ou: FICHE, valeur: f.places_libres === "0" ? "Complet" : `${f.places_libres} libre${Number(f.places_libres) > 1 ? "s" : ""}` }], pourquoi: "Un geste suffit pour dire que c’est toujours vrai. La date montre que l’info est à jour.", action: { label: "Confirmer", partie: "places" } });
  else
    choisit.push({ id: "places", etat: "ok", titre: f.places_libres === "0" ? "Tu dis que tu es complet" : "Tes places libres sont dites", vu: [{ ou: FICHE, valeur: f.places_libres === "0" ? "Complet" : `${f.places_libres} libre${Number(f.places_libres) > 1 ? "s" : ""}` }], pourquoi: "C’est la première chose que cherche un propriétaire." });
  const prix = !!f.prix_min || f.formules.some((x) => !!x.prix);
  choisit.push(
    prix
      ? { id: "prix", etat: "ok", titre: "Ton prix est affiché", vu: [{ ou: FICHE, valeur: f.prix_min ? `À partir de ${f.prix_min} €` : "Dans tes formules" }], pourquoi: "Il peut comparer sans t’appeler." }
      : { id: "prix", etat: "ko", titre: "Ton prix n’est pas affiché", vu: [{ ou: FICHE, valeur: "Sur demande", mauvais: true }], pourquoi: "Il compare sans appeler. Un prix « à partir de » suffit si tes tarifs varient.", action: { label: "Mettre mon prix", partie: "places" } },
  );
  const nph = f.photos.length;
  choisit.push(
    nph >= 3
      ? { id: "photos", etat: "ok", titre: "Tu as des photos", vu: [{ ou: FICHE, valeur: `${nph} photos` }], pourquoi: "Il voit le lieu avant de venir." }
      : { id: "photos", etat: nph === 0 ? "ko" : "mid", titre: nph === 0 ? "Aucune photo" : "Pas assez de photos", vu: [{ ou: FICHE, valeur: `${nph} photo${nph > 1 ? "s" : ""}`, mauvais: true }], pourquoi: "Trois photos au moins : le pré ou la cour, les abris, le foin. Prises au téléphone, c’est parfait.", action: { label: "Ajouter des photos", partie: "photos" } },
  );
  const pres = f.description.trim().length >= PRESENTATION_MIN;
  if (!pres) choisit.push({ id: "presentation", etat: "mid", titre: "Ta présentation est trop courte", vu: [{ ou: FICHE, valeur: f.description.trim() ? "Quelques mots" : "Rien", mauvais: true }], pourquoi: "Quelques lignes sur le cadre et la vie des chevaux : c’est ce qui te distingue d’à côté.", action: { label: "L’écrire", partie: "contact" } });
  else choisit.push({ id: "presentation", etat: "ok", titre: "Ta présentation est écrite", vu: [{ ou: FICHE, valeur: "Complète" }], pourquoi: "Il sait ce qui fait ton écurie." });
  const manque = (["hebergement", "installations", "services"] as const).filter((k) => f[k].length === 0);
  choisit.push(
    manque.length
      ? { id: "propose", etat: "mid", titre: "Ce que tu proposes n’est pas complet", vu: [{ ou: FICHE, valeur: `${3 - manque.length} sur 3 remplis`, mauvais: true }], pourquoi: "Hébergement, installations, services : ils servent aux filtres de recherche des cavaliers.", action: { label: "Compléter", partie: "propose" } }
      : { id: "propose", etat: "ok", titre: "Ce que tu proposes est dit", vu: [{ ou: FICHE, valeur: "Hébergement, installations, services" }], pourquoi: "Tu sors quand un cavalier filtre sa recherche." },
  );

  // 3. Il t'écrit
  const ecrit: Point[] = [];
  ecrit.push(
    f.email.trim()
      ? { id: "email", etat: "ok", titre: "Les demandes t’arrivent", vu: [{ ou: FICHE, valeur: "E-mail renseigné" }], pourquoi: "Chaque demande de cavalier arrive ici et par e-mail." }
      : { id: "email", etat: "ko", titre: "Aucune adresse pour recevoir les demandes", vu: [{ ou: FICHE, valeur: "Rien", mauvais: true }], pourquoi: "Sans e-mail, une demande de cavalier n’arrive nulle part.", action: { label: "L’ajouter", partie: "contact" } },
  );
  ecrit.push(
    f.telephone.trim()
      ? { id: "tel", etat: "ok", titre: "Ton numéro est affiché", vu: [{ ou: FICHE, valeur: f.telephone }], pourquoi: "Ceux qui préfèrent appeler peuvent le faire." }
      : { id: "tel", etat: "mid", titre: "Pas de numéro affiché", vu: [{ ou: FICHE, valeur: "Rien" }], pourquoi: "Certains cavaliers préfèrent appeler. Laisse-le vide si tu veux seulement des demandes écrites.", action: { label: "L’ajouter", partie: "contact" } },
  );
  const attente = demandes.filter((d) => !((d.reponses?.length ?? 0) > 0 || repondues.includes(d.id)));
  const vieilles = attente.filter((d) => maintenant.getTime() - new Date(d.date).getTime() > JOUR);
  if (demandes.length)
    ecrit.push(
      vieilles.length
        ? { id: "reponse", etat: "ko", titre: `${vieilles.length} demande${vieilles.length > 1 ? "s attendent" : " attend"} depuis plus d’un jour`, vu: [{ ou: "Tes demandes", valeur: `${attente.length} sans réponse`, mauvais: true }], pourquoi: "Une demande sans réponse rapide part souvent chez le voisin." }
        : attente.length
          ? { id: "reponse", etat: "mid", titre: `${attente.length} demande${attente.length > 1 ? "s" : ""} à répondre`, vu: [{ ou: "Tes demandes", valeur: "Arrivées aujourd’hui" }], pourquoi: "Répondre dans la journée fait souvent la différence." }
          : { id: "reponse", etat: "ok", titre: "Tu réponds à tes demandes", vu: [{ ou: "Tes demandes", valeur: `${demandes.length} répondue${demandes.length > 1 ? "s" : ""}` }], pourquoi: "Le cavalier qui écrit a une réponse." },
    );

  const etape = (id: EtapeId, titre: string, scene: string, points: Point[], verdicts: Record<EtatPoint, string>): Etape => {
    const e = pire(points.map((p) => p.etat));
    // Le pire d'abord, puis à revoir, puis ce qui va.
    const ordre: Record<EtatPoint, number> = { ko: 0, mid: 1, ok: 2 };
    return { id, titre, scene, etat: e, verdict: verdicts[e], points: [...points].sort((a, b) => ordre[a.etat] - ordre[b.etat]) };
  };
  return [
    etape(1, "Il te trouve", "Il tape « pension cheval » et sa commune sur son téléphone.", trouve, {
      ko: "On a du mal à te trouver.",
      mid: "On te trouve, mais il manque des choses.",
      ok: "On te trouve facilement.",
    }),
    etape(2, "Il te choisit", "Le soir, il compare deux ou trois écuries.", choisit, {
      ko: "Il compare sans voir l’essentiel.",
      mid: "Il voit l’essentiel. Il reste des choses à montrer.",
      ok: "Il voit tout ce qu’il cherche avant d’écrire.",
    }),
    etape(3, "Il t’écrit", "Il appelle, envoie un message, ou passe.", ecrit, {
      ko: "Il a du mal à te joindre.",
      mid: "On peut te joindre. Il reste un détail.",
      ok: "On peut te joindre facilement.",
    }),
  ];
}

/** Le compte d'une étape : à corriger, à revoir, c'est bon. */
export function compte(e: Etape): Record<EtatPoint, number> {
  return { ko: e.points.filter((p) => p.etat === "ko").length, mid: e.points.filter((p) => p.etat === "mid").length, ok: e.points.filter((p) => p.etat === "ok").length };
}

/** La prochaine chose à faire : le premier point à corriger qui a une action, sinon le premier à revoir. */
export function prochaine(etapes: Etape[]): Point | null {
  const tous = etapes.flatMap((e) => e.points).filter((p) => p.action);
  return tous.find((p) => p.etat === "ko") ?? tous.find((p) => p.etat === "mid") ?? null;
}

/** Les mots d'un état, pour les étiquettes. */
export const MOTS: Record<EtatPoint, string> = { ko: "Ça coince", mid: "À revoir", ok: "Ça va" };
export const MOTS_POINT: Record<EtatPoint, string> = { ko: "À corriger", mid: "À revoir", ok: "C’est bon" };
