// La grille de l'audit (27 novembre 2026, reprise de l'app du Clos) : la même
// pour toutes les écuries.
//
// Trois volets, dix critères chacun. Chaque critère pose une question simple,
// dit comment on la mesure et écrit sa règle : 2 points, 1 point ou 0. La note
// d'un volet est la somme des critères mesurés ; refaire la mesure redonne la
// même note. Un critère qu'on ne peut pas lire reste « à mesurer » : il ne
// compte ni pour ni contre. On ne juge jamais une source qu'on n'a pas lue.
//
// Sur l'appareil, aujourd'hui :
//  - « Te trouver » et « Te choisir » se lisent sur la fiche bestable.fr et les
//    demandes reçues. Google, les annonces, Facebook et Instagram restent « à
//    mesurer » jusqu'au service d'audit du VPS (DataForSEO, Apify) ;
//  - « En vivre » se lit dans les données de l'écurie (pensions, séances,
//    frais) et dans tes réponses : aucune estimation.

import type { DemandeCavalier, Fiche } from "@/lib/account/api";
import type { StableData } from "@/lib/domain/types";
import { GRILLE, type Critere, type Pts, type Resultat, type Vu } from "@/lib/audit/grille-criteres";
import { monthBreakdown, reconciledNets, estAuGerant } from "@/lib/domain/ticket";
import { chevauxPresents } from "@/lib/domain/presence";
import { prixDe } from "@/lib/domain/ajouter";
import { seanceToValidate } from "@/lib/domain/seances";

export { GRILLE, VOLETS } from "@/lib/audit/grille-criteres";
export type { VoletKey, Pts, Critere, Vu, Geste, Resultat, Volet } from "@/lib/audit/grille-criteres";

/** Les trois questions qu'on ne voit pas de l'extérieur : la réponse du gérant. */
export const QUESTIONS_VIVRE: Record<string, string> = {
  "v-hausse": "Ta dernière hausse de prix : quand, et de combien ?",
  "v-foin": "Le prix payé pour le foin la dernière fois, et le tonnage par an.",
  "v-heures": "Les heures par semaine, les tiennes et celles des autres.",
};

const FICHE = "Ta fiche bestable.fr";
const JOUR = 86_400_000;
const EN_LIGNE = "Se lit en ligne : au prochain audit complet, avec ton accord.";

export type FicheGrille = Pick<Fiche, "en_attente" | "site" | "places_libres" | "places_maj" | "prix_min" | "formules" | "photos" | "description" | "telephone" | "email">;
export type DemandeGrille = Pick<DemandeCavalier, "id" | "date" | "reponses">;

export interface EntreeGrille {
  /** null : l'écurie n'a pas encore de fiche à son nom. */
  fiche: FicheGrille | null;
  demandes: DemandeGrille[];
  repondues: number[];
  data: StableData;
  capacity: number;
  objective: number;
  objectiveCa: number;
  maintenant?: Date;
}

const parRegle = (x: number, a2: number, a1: number): Pts => (x >= a2 ? 2 : x >= a1 ? 1 : 0);
const pl = (n: number, un: string, des: string) => `${n} ${n > 1 ? des : un}`;
const aMesurer = (constat: string, question?: string): Resultat => ({ points: null, constat, question });

/** « Te trouver » et « Te choisir » : ce qui se lit sur la fiche et dans les demandes. */
export function mesureFiche(f: FicheGrille | null, demandes: DemandeGrille[], repondues: number[], maintenant = new Date()): Record<string, Resultat> {
  const out: Record<string, Resultat> = {};
  for (const id of ["t-google", "t-avis", "t-avis-recents", "t-facebook", "t-instagram", "t-annonces", "t-nap", "t-lien", "c-memes-prix", "c-capacite", "c-conditions"]) out[id] = aMesurer(EN_LIGNE);

  if (!f) {
    out["t-bestable"] = { points: 0, constat: "Ton écurie n’a pas encore sa fiche à ton nom.", geste: { titre: "Retrouver ton écurie sur bestable.fr et la mettre à ton nom", qui: "Toi", effort: "5 min" } };
    for (const id of ["t-site", "c-prix", "c-compris", "c-places", "c-photos", "c-atout", "c-joindre"]) out[id] = aMesurer("Se lit sur ta fiche, dès qu’elle est à ton nom.");
    out["c-reponse"] = aMesurer("Les demandes arrivent sur ta fiche, dès qu’elle est à ton nom.");
    return out;
  }

  // Ta fiche bestable.fr.
  const jours = f.places_maj ? Math.floor((maintenant.getTime() - new Date(f.places_maj + "T12:00:00").getTime()) / JOUR) : null;
  out["t-bestable"] = f.en_attente
    ? { points: 1, constat: "Ta fiche est en cours de vérification.", vu: [{ ou: FICHE, valeur: "En vérification" }] }
    : jours != null && jours <= 30
      ? { points: 2, constat: `Ta fiche est à ton nom, places confirmées il y a ${jours <= 1 ? "un jour" : `${jours} jours`}.`, vu: [{ ou: FICHE, valeur: "À ton nom" }] }
      : {
          points: 1,
          constat: jours == null ? "Ta fiche est à ton nom, mais tes places n’ont jamais été confirmées." : `Ta fiche est à ton nom, places confirmées il y a ${jours} jours.`,
          vu: [{ ou: FICHE, valeur: jours == null ? "Places jamais confirmées" : `Places : il y a ${jours} jours`, mauvais: true }],
          geste: { titre: "Confirmer tes places sur ta fiche", qui: "Toi, dans la Vitrine", effort: "1 min" },
        };

  // Ton site : sa position se lit en ligne ; sans site, c'est 0.
  out["t-site"] = f.site.trim()
    ? aMesurer("Ta position sur « pension cheval » et ta commune se lit en ligne, au prochain audit complet.")
    : { points: 0, constat: "Aucun site ni page indiqués sur ta fiche.", vu: [{ ou: FICHE, valeur: "Pas de site", mauvais: true }], geste: { titre: "Mettre ton site en ligne, fait à partir de ta fiche", qui: "Toi, dans la Vitrine (Mon site)", effort: "10 min" } };

  // Le prix.
  const formules = f.formules.filter((x) => x.nom.trim());
  const avecPrix = formules.filter((x) => !!String(x.prix ?? "").trim());
  out["c-prix"] =
    formules.length && avecPrix.length === formules.length
      ? { points: 2, constat: `Le prix de ${formules.length > 1 ? `tes ${formules.length} formules` : "ta formule"} est affiché.`, vu: avecPrix.map((x) => ({ ou: FICHE, valeur: `${x.nom} : ${x.prix} €` })) }
      : avecPrix.length || f.prix_min
        ? { points: 1, constat: avecPrix.length ? "Une partie de tes formules n’a pas de prix." : "Un prix « à partir de », sans le détail des formules.", vu: [{ ou: FICHE, valeur: f.prix_min ? `À partir de ${f.prix_min} €` : `${avecPrix.length} sur ${formules.length} avec un prix` }], geste: { titre: "Mettre le prix de chaque formule", qui: "Toi, dans la Vitrine", effort: "5 min" } }
        : { points: 0, constat: "Aucun prix affiché sur ta fiche.", vu: [{ ou: FICHE, valeur: "Sur demande", mauvais: true }], geste: { titre: "Afficher ton prix, au moins « à partir de »", qui: "Toi, dans la Vitrine", effort: "2 min" } };

  // Ce qui est compris : la description de chaque formule.
  const decrites = formules.filter((x) => (x.description ?? "").trim().length >= 10);
  out["c-compris"] = !formules.length
    ? { points: 0, constat: "Pas de formule sur ta fiche : rien ne dit ce qui est compris.", geste: { titre: "Écrire tes formules et ce qu’elles comprennent", qui: "Toi, dans la Vitrine", effort: "15 min" } }
    : { points: decrites.length === formules.length ? 2 : decrites.length ? 1 : 0, constat: `${decrites.length} formule${decrites.length > 1 ? "s" : ""} sur ${formules.length} ${decrites.length > 1 ? "disent" : "dit"} ce qui est compris.`, geste: decrites.length < formules.length ? { titre: "Écrire ce que comprend chaque formule : foin, litière, sorties, soins", qui: "Toi, dans la Vitrine", effort: "15 min" } : undefined };

  // Les places.
  out["c-places"] =
    f.places_libres === "" || f.places_libres == null
      ? { points: 0, constat: "Ta fiche ne dit pas s’il y a de la place.", vu: [{ ou: FICHE, valeur: "Rien", mauvais: true }], geste: { titre: "Dire tes places libres, même « complet »", qui: "Toi, dans la Vitrine", effort: "1 min" } }
      : { points: 2, constat: f.places_libres === "0" ? "Ta fiche dit que tu es complet." : `Ta fiche dit ${pl(Number(f.places_libres), "place libre", "places libres")}.`, vu: [{ ou: FICHE, valeur: f.places_libres === "0" ? "Complet" : `${f.places_libres} libre${Number(f.places_libres) > 1 ? "s" : ""}` }] };

  // Les photos.
  const nph = f.photos.length;
  out["c-photos"] = { points: parRegle(nph, 10, 3), constat: nph ? `${pl(nph, "photo", "photos")} sur ta fiche.` : "Aucune photo sur ta fiche.", vu: [{ ou: FICHE, valeur: pl(nph, "photo", "photos"), mauvais: nph < 3 }], geste: nph < 10 ? { titre: "Ajouter des photos : prés, abris, foin, sellerie", qui: "Toi, au téléphone", effort: "15 min" } : undefined };

  // L'atout : sans présentation, il n'est dit nulle part ; sinon il se lit.
  out["c-atout"] = f.description.trim()
    ? aMesurer("Ta présentation est écrite : ce qu’elle dit en premier se lit au prochain audit complet.")
    : { points: 0, constat: "Ta fiche n’a pas de présentation : ton atout n’est dit nulle part.", geste: { titre: "Écrire ta présentation, ton atout dans la première phrase", qui: "Toi, dans la Vitrine", effort: "15 min" } };

  // Te joindre : un e-mail ouvre le formulaire de demande de la fiche.
  const tel = !!f.telephone.trim();
  const mail = !!f.email.trim();
  out["c-joindre"] =
    tel && mail
      ? { points: 2, constat: "Ton numéro est affiché et le formulaire de demande t’arrive.", vu: [{ ou: FICHE, valeur: f.telephone }, { ou: FICHE, valeur: "Formulaire de demande" }] }
      : tel || mail
        ? { points: 1, constat: tel ? "Ton numéro est affiché, mais aucune adresse ne reçoit les demandes écrites." : "Les demandes écrites t’arrivent, mais ton numéro n’est pas affiché.", geste: { titre: tel ? "Ajouter ton e-mail pour recevoir les demandes" : "Afficher ton numéro", qui: "Toi, dans la Vitrine", effort: "1 min" } }
        : { points: 0, constat: "Ni numéro ni e-mail sur ta fiche : il faut chercher pour te joindre.", geste: { titre: "Ajouter ton numéro et ton e-mail", qui: "Toi, dans la Vitrine", effort: "2 min" } };

  // Réponds-tu vite ?
  const attente = demandes.filter((d) => !((d.reponses?.length ?? 0) > 0 || repondues.includes(d.id)) && maintenant.getTime() - new Date(d.date).getTime() > JOUR).length;
  out["c-reponse"] = !demandes.length
    ? aMesurer("Aucune demande reçue sur ta fiche pour l’instant : rien à mesurer.")
    : { points: attente === 0 ? 2 : attente === 1 ? 1 : 0, constat: attente ? `${pl(attente, "demande attend", "demandes attendent")} depuis plus d’un jour.` : "Aucune demande ne traîne.", geste: attente ? { titre: "Répondre aux demandes en attente", qui: "Toi, dans Demandes", effort: "5 min" } : undefined };

  return out;
}

/** « En vivre » : ce qui se lit dans les données de l'écurie, à l'instant. */
export function mesureVivre(e: Pick<EntreeGrille, "data" | "capacity" | "objective" | "objectiveCa">, maintenant = new Date()): Record<string, Resultat> {
  const { data } = e;
  const period = { year: maintenant.getFullYear(), month: maintenant.getMonth() + 1 };
  const mois = `${period.year}-${String(period.month).padStart(2, "0")}`;
  const today = `${mois}-${String(maintenant.getDate()).padStart(2, "0")}`;
  const hm = `${String(maintenant.getHours()).padStart(2, "0")}:${String(maintenant.getMinutes()).padStart(2, "0")}`;
  const m = monthBreakdown(data, period);
  const out: Record<string, Resultat> = {};

  // Chaque pension couvre son cheval.
  const enPension = chevauxPresents(data, period).filter((h) => !estAuGerant(h));
  if (!enPension.length) {
    out["v-couvre"] = { points: null, constat: "Aucun cheval en pension ce mois-ci : rien à comparer.", question: "Ajoute tes chevaux en pension dans Mon écurie." };
  } else {
    const nets = reconciledNets(data, period);
    const l = enPension.map((h) => ({ nom: h.name, net: nets[h.id] ?? 0 }));
    const ok = l.filter((x) => Math.round(x.net) >= 0).length;
    out["v-couvre"] = {
      points: ok === l.length ? 2 : ok * 2 >= l.length ? 1 : 0,
      constat: `${ok} cheva${ok > 1 ? "ux" : "l"} en pension sur ${l.length} couvre${ok > 1 ? "nt" : ""} ses frais ce mois-ci.`,
      vu: l.map((x) => ({ ou: x.nom, valeur: `${x.net >= 0 ? "laisse" : "coûte"} ${Math.abs(Math.round(x.net))} €`, mauvais: Math.round(x.net) < 0 })),
      geste: ok < l.length ? { titre: "Ouvrir la fiche des chevaux qui coûtent, pour voir ce qui pèse", qui: "Toi, dans Mon écurie", effort: "10 min" } : undefined,
    };
  }

  // Remplissage.
  if (!e.capacity) {
    out["v-remplissage"] = { points: null, constat: "Ta capacité n’est pas renseignée.", question: "Indique combien de chevaux tu peux accueillir (Vitrine, Mes places)." };
  } else {
    const pct = Math.round((m.pensions / e.capacity) * 100);
    out["v-remplissage"] = { points: parRegle(pct, 90, 70), constat: `${pl(m.pensions, "cheval", "chevaux")} en pension pour ${e.capacity} places : ${pct} %.`, vu: [{ ou: "Tes chevaux", valeur: pl(m.pensions, "pension", "pensions") }, { ou: "Ta capacité", valeur: `${e.capacity} places` }] };
  }

  // Prix des prestations.
  const actives = (data.prestations ?? []).filter((p) => p.active);
  const sansPrix = actives.filter((p) => !(p.price > 0 || (prixDe(p, undefined, data.tariffs) ?? 0) > 0 || (prixDe(p, "collectif", data.tariffs) ?? 0) > 0));
  out["v-prix"] = actives.length
    ? {
        points: sansPrix.length === 0 ? 2 : (actives.length - sansPrix.length) * 2 >= actives.length ? 1 : 0,
        constat: `${actives.length - sansPrix.length} prestation${actives.length - sansPrix.length > 1 ? "s" : ""} sur ${actives.length} ${actives.length - sansPrix.length > 1 ? "ont" : "a"} un prix.`,
        vu: sansPrix.map((p) => ({ ou: p.label, valeur: "Pas de prix", mauvais: true })),
        geste: sansPrix.length ? { titre: "Fixer le prix des prestations qui n’en ont pas", qui: "Toi, dans Mon écurie", effort: "5 min" } : undefined,
      }
    : { points: null, constat: "Aucune prestation créée.", question: "Crée tes prestations dans Mon écurie (cours, travail, balades)." };

  // Validations du mois.
  const enAttente = (data.seances ?? []).filter((s) => s.date.startsWith(mois) && seanceToValidate(s, today, hm)).length;
  out["v-validees"] = {
    points: enAttente === 0 ? 2 : enAttente <= 5 ? 1 : 0,
    constat: enAttente ? `${pl(enAttente, "séance passée pas encore validée", "séances passées pas encore validées")}.` : "Tout ce qui est passé est validé.",
    geste: enAttente ? { titre: "Valider les séances en attente", qui: "Toi, dans le Planning", effort: "2 min" } : undefined,
  };

  // Frais notés : les postes du mois (foin, loyer…), et les soins des chevaux.
  // Seulement ce qui est noté pour de vrai, pas l'estimation des premiers pas.
  const postes = new Set([...m.shared, ...m.outs].filter((l) => Math.abs(l.reel ?? (l.estime ? 0 : l.amount)) > 0).map((l) => l.label.trim().toLowerCase()));
  const nFrais = postes.size + (m.direct > 0 ? 1 : 0);
  out["v-frais"] = {
    points: parRegle(nFrais, 3, 1),
    constat: nFrais ? `${pl(nFrais, "catégorie de frais notée", "catégories de frais notées")} ce mois-ci.` : "Aucun frais noté ce mois-ci.",
    geste: nFrais < 3 ? { titre: "Noter le foin, la litière et le maréchal du mois", qui: "Toi, dans Mon écurie (Mes frais)", effort: "5 min" } : undefined,
  };

  // Sources.
  const pensions = m.ins.some((l) => /pension/i.test(l.label) && l.amount > 0);
  const seances = (data.seances ?? []).some((s) => s.status === "done" && s.date.startsWith(mois));
  out["v-sources"] = {
    points: pensions && seances ? 2 : pensions || seances ? 1 : 0,
    constat: pensions && seances ? "Pensions et séances rapportent ce mois-ci." : pensions ? "Seules les pensions rapportent ce mois-ci." : seances ? "Seules les séances rapportent ce mois-ci." : "Rien de saisi ce mois-ci.",
  };

  // Objectif.
  out["v-objectif"] =
    e.objectiveCa > 0
      ? { points: 2, constat: `Un chiffre d’affaires est visé : ${e.objectiveCa.toLocaleString("fr-FR")} € par mois.` }
      : e.objective > 0
        ? { points: 1, constat: `Tu vises qu’il te reste ${e.objective.toLocaleString("fr-FR")} € par mois, sans chiffre d’affaires visé.`, geste: { titre: "Fixer le chiffre d’affaires visé du mois", qui: "Toi, dans l’Analyse", effort: "2 min" } }
        : { points: 0, constat: "Pas d’objectif pour le mois.", geste: { titre: "Fixer ton objectif du mois", qui: "Toi, dans l’Analyse", effort: "2 min" } };

  // Les trois questions.
  for (const id of Object.keys(QUESTIONS_VIVRE)) {
    const r = (data.reponsesAudit?.[id] ?? "").trim();
    out[id] = r
      ? { points: null, constat: `Ta réponse : « ${r} ». Elle sera notée au prochain audit complet.`, question: QUESTIONS_VIVRE[id] }
      : { points: null, constat: "Ça ne se voit pas de l’extérieur : il faut ta réponse.", question: QUESTIONS_VIVRE[id] };
  }
  return out;
}

export interface Ligne extends Critere {
  r: Resultat;
}

/** Les 30 critères, chacun avec ce que l'audit a trouvé. */
export function resultats(e: EntreeGrille): Ligne[] {
  const maintenant = e.maintenant ?? new Date();
  const lus = { ...mesureFiche(e.fiche, e.demandes, e.repondues, maintenant), ...mesureVivre(e, maintenant) };
  return GRILLE.map((c) => ({ ...c, r: lus[c.id] ?? { points: null, constat: "Pas encore mesuré." } }));
}

export interface Note {
  points: number;
  sur: number;
  mesures: number;
  aMesurer: number;
}
export function noteDe(l: Ligne[]): Note {
  const m = l.filter((x) => x.r.points != null);
  return { points: m.reduce((n, x) => n + (x.r.points as number), 0), sur: m.length * 2, mesures: m.length, aMesurer: l.length - m.length };
}

/** Les gestes qui rapportent le plus de points, du plus urgent au moins urgent. */
export function premiersGestes(l: Ligne[], n = 3): Ligne[] {
  return l
    .filter((x) => x.r.geste && x.r.points != null && x.r.points < 2)
    .sort((a, b) => (a.r.points as number) - (b.r.points as number))
    .slice(0, n);
}

export type { Vu as VuGrille };
