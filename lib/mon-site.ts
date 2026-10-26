import type { Choix, Fiche } from "@/lib/account/api";

/**
 * « Mon site » (agence des écuries, 26 octobre 2026) : le site de l'écurie,
 * fabriqué à partir de sa fiche bestable.fr, et l'offre pour le mettre en
 * ligne. Ici, la logique sans écran : le métier, l'adresse, les prix, le
 * lien de paiement.
 */

export type Metier = "pension" | "centre" | "elevage";
export type Formule = "site" | "google";
export type Rythme = "mois" | "an";

/** Prix hors taxes retenus pour le test (note du 26 octobre, fin de soirée). */
export const PRIX: Record<Formule, Record<Rythme, number>> = {
  site: { mois: 29, an: 290 },
  google: { mois: 49, an: 490 },
};
export const PRIX_DOMAINE = { mois: 2, an: 20 };

export const NOM_FORMULE: Record<Formule, string> = { site: "Le site", google: "Le site et Google" };

/** Ce que chaque formule contient, dans l'ordre où on le lit. */
export const INCLUS: Record<Formule, string[]> = {
  site: ["Ton site, fait à partir de ta fiche", "Ton adresse nom.bestable.fr", "Tout se modifie ici, dans l’app", "2 changements par mois par WhatsApp", "Un point tous les trois mois"],
  google: ["Tout ce que contient Le site", "Ton propre nom de domaine, compris", "Ta fiche Google tenue à jour : photos, horaires, réponses aux avis", "4 changements par mois par WhatsApp"],
};

export const NOM_METIER: Record<Metier, string> = { pension: "Pension", centre: "Centre équestre", elevage: "Élevage" };

const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Le métier principal, lu dans ce que la fiche propose (clés et libellés des
 * activités et de l'hébergement). Une pension avant tout : c'est le cœur de
 * l'annuaire ; l'élevage seulement s'il n'y a ni pension ni cours.
 */
export function metierDe(f: Pick<Fiche, "offres" | "hebergement" | "formules" | "prix_min" | "places_libres">, choix?: Choix | null): Metier {
  const mots = [...f.offres, ...f.hebergement].map((k) => sansAccent(`${k} ${choix?.offres?.[k] ?? ""} ${choix?.hebergement?.[k] ?? ""}`)).join(" ");
  const pension = /pension|box|paddock|pre\b|retraite/.test(mots) || f.formules.length > 0 || Number(f.prix_min) > 0;
  const cours = /cours|stage|poney|club|enseign|lecon/.test(mots);
  const elevage = /elevage|saillie|poulain|etalon|vente/.test(mots);
  if (pension) return "pension";
  if (cours) return "centre";
  if (elevage) return "elevage";
  return "pension";
}

/** L'adresse offerte : « ecurie-du-grand-pre.bestable.fr ». */
export function adresseOfferte(titre: string): string {
  const s = sansAccent(titre || "mon-ecurie")
    .replace(/['’]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return `${s || "mon-ecurie"}.bestable.fr`;
}

/** La grande phrase du site : la première phrase de la présentation, sinon une phrase du métier. */
export function accroche(f: Pick<Fiche, "description" | "commune">, metier: Metier): string {
  const premiere = (f.description || "").trim().split(/(?<=[.!?])\s+/)[0]?.trim() ?? "";
  if (premiere.length >= 20 && premiere.length <= 110) return premiere;
  const a = f.commune ? ` à ${f.commune}` : "";
  return metier === "centre" ? `Cours et stages d’équitation${a}.` : metier === "elevage" ? `Nos chevaux, élevés${a}.` : `Votre cheval en pension${a}.`;
}

const nf = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/[  ]/g, " ");
export const euros = (n: number) => `${nf(n)} €`;

/** « 29 € par mois », « 290 € par an ». */
export const prixDit = (f: Formule, r: Rythme) => `${euros(PRIX[f][r])} par ${r === "mois" ? "mois" : "an"}`;

/**
 * Le lien de paiement de la formule, s'il est réglé (lien d'abonnement de
 * l'outil de paiement, par exemple un « Payment Link » Stripe). La fiche part
 * en référence pour relier le paiement à l'écurie, l'e-mail est proposé.
 * Sans lien réglé : null, et l'écran envoie une demande à la place.
 */
export function lienPaiement(f: Formule, r: Rythme, ficheId?: number, email?: string): string | null {
  const liens: Record<string, string | undefined> = {
    "site-mois": process.env.NEXT_PUBLIC_PAIEMENT_SITE_MOIS,
    "site-an": process.env.NEXT_PUBLIC_PAIEMENT_SITE_AN,
    "google-mois": process.env.NEXT_PUBLIC_PAIEMENT_GOOGLE_MOIS,
    "google-an": process.env.NEXT_PUBLIC_PAIEMENT_GOOGLE_AN,
  };
  const base = liens[`${f}-${r}`];
  if (!base) return null;
  try {
    const u = new URL(base);
    if (ficheId) u.searchParams.set("client_reference_id", `fiche-${ficheId}`);
    if (email) u.searchParams.set("prefilled_email", email);
    return u.toString();
  } catch {
    return null;
  }
}

/** Le message envoyé à l'équipe quand le paiement en ligne n'est pas encore réglé. */
export function messageDemande(f: Formule, r: Rythme, fiche: Pick<Fiche, "id" | "title" | "commune">, domaine: boolean): string {
  return [
    `Mettre mon site en ligne : ${NOM_FORMULE[f]}, ${prixDit(f, r)}.`,
    f === "site" && domaine ? `Avec mon propre nom de domaine (${euros(PRIX_DOMAINE[r])} par ${r === "mois" ? "mois" : "an"}).` : "",
    `Écurie : ${fiche.title}${fiche.commune ? `, ${fiche.commune}` : ""}${fiche.id ? ` (fiche ${fiche.id})` : ""}.`,
    `Adresse proposée : ${adresseOfferte(fiche.title)}.`,
  ]
    .filter(Boolean)
    .join("\n");
}
