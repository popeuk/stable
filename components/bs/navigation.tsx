"use client";

import { usePathname, useRouter } from "next/navigation";
import { useParentIci } from "@/components/bs/nav";
import { Ic } from "@/components/carnet/ui";
import { QUATRE_PARTIES } from "@/lib/fonctions";

/**
 * La navigation (27 octobre 2026, l'app en briques) : quatre onglets (Accueil,
 * Vitrine, Demandes, Clients) et le +, toujours à la même place quelle que
 * soit l'offre ; « Mon bilan » (seulement avec Mon argent) et la roue des
 * réglages en haut à droite. Mon écurie (les coulisses) est sous la roue. Chaque écran a un seul parent, et le retour y mène
 * toujours en disant son nom, quel que soit le chemin pris pour venir.
 */
/** Les quatre onglets : ils n'ont pas de retour. */
const ROOTS_AVANT = ["/accueil", "/ma-fiche", "/demandes", "/chevaux", "/audit", "/apprendre"];
/**
 * Les cinq onglets, repris de l'app du Clos (27 novembre 2026, décision de
 * Samuel, derrière QUATRE_PARTIES) : Accueil, Planning, Mon écurie, Suivi,
 * Analyse. Suivi, c'est l'argent du mois (Bilan, Revenus et frais) ; Analyse,
 * l'audit en trois volets (Te trouver, Te choisir, En vivre). La Vitrine (ta
 * fiche, Mon site) monte en haut à droite, avec l'enveloppe des demandes et
 * la roue. Mon écurie : Clients, Chevaux, Prestations ; l'équipe, les pros et
 * les papiers vont dans les Réglages, comme au Clos.
 */
export const ANALYSE_ONGLETS = ["/te-trouver", "/te-choisir", "/en-vivre"];
export const ONGLETS_CINQ = { accueil: "/accueil", planning: "/planning", ecurie: "/chevaux?vue=clients", suivi: "/argent", analyse: "/te-trouver" };
/** Les écrans de chaque onglet : l'onglet reste allumé. */
export const TAB_PLANNING = ["/planning", "/valider", "/equipe"];
export const TAB_VITRINE = ["/ma-fiche", "/mon-site", "/parcours/tarifs"];
export const TAB_SUIVI = ["/argent", "/tva", "/seuil", "/pilotage", "/part", "/scenarios", "/mois", "/conseiller", "/decouvertes", "/depenses", "/parcours/factures"];
export const TAB_ANALYSE = [...ANALYSE_ONGLETS, "/audit"];
export const TAB_ECURIE = ["/ecurie", "/chevaux", "/clients", "/client", "/ticket", "/cheval", "/facture", "/prestations", "/facturation", "/saisie"];
export const ROOTS2 = QUATRE_PARTIES ? ["/accueil", "/planning", "/argent", ...ANALYSE_ONGLETS, "/chevaux", "/prestations", "/ma-fiche", "/mon-site"] : ROOTS_AVANT;
/** Les écrans de Mon argent et du planning : sous cadenas ou « bientôt » tant que la brique n'est pas ouverte (components/bs/porte-brique.tsx). */
export const ARGENT = ["/argent", "/chevaux", "/client", "/ticket", "/seuil", "/pilotage", "/part", "/prestations", "/scenarios", "/mois", "/depenses", "/facture", "/facturation", "/saisie", "/conseiller", "/decouvertes"];
export const PLANNING = ["/planning", "/valider", "/equipe"];
/** Les écrans de Mon écurie : l'onglet reste allumé. */
export const ECURIE = ["/ecurie", "/parcours/tarifs", "/parcours/factures", "/contacts", "/ma-fiche", "/mon-site", "/facturation", "/registre"];

/** Chaque écran a un seul parent, quel que soit le chemin pris pour y venir. */
const PARENTS_CINQ: [string, string][] = QUATRE_PARTIES
  ? [
      ["/clients", "/chevaux?vue=clients"],
      ["/depenses", "/argent"],
      ["/tva", "/argent"],
      ["/parcours/factures", "/argent"],
      ["/demandes", "/accueil"],
      ["/audit", "/te-trouver"],
      ["/apprendre", "/accueil"],
      ["/contacts", "/reglages"],
      ["/facturation", "/reglages"],
      ["/registre", "/reglages"],
    ]
  : [];
const PARENTS2: [string, string][] = [
  ...PARENTS_CINQ,
  ["/ticket", "/chevaux?vue=chevaux"],
  ["/saisie/cheval", "/chevaux?vue=chevaux"],
  ["/client", "/chevaux?vue=clients"],
  ["/facture", "/chevaux?vue=clients"],
  ["/valider", "/planning"],
  ["/equipe", "/planning"],
  ["/scenarios/nouveau", "/scenarios"],
  ["/scenarios", "/argent"],
  ["/seuil", "/argent"],
  ["/pilotage", "/argent"],
  ["/part", "/argent"],
  ["/prestations", "/argent"],
  ["/argent", "/accueil"],
  ["/reglages", "/accueil"],
  ["/ecurie", "/reglages"],
  ["/moi", "/reglages"],
  ["/regles", "/reglages"],
  ["/parametres", "/reglages"],
  ["/contacts", "/ecurie"],
  ["/mon-site", "/ma-fiche"],
  ["/facturation", "/ecurie"],
  ["/registre", "/ecurie"],
];
const NOMS: [string, string][] = [
  ...(QUATRE_PARTIES
    ? ([
        ["/argent", "Suivi"],
        ["/te-trouver", "Analyse"],
        ["/te-choisir", "Analyse"],
        ["/en-vivre", "Analyse"],
      ] as [string, string][])
    : []),
  ["/chevaux?vue=chevaux", "Chevaux"],
  ["/chevaux", "Clients"],
  ["/planning", "Planning"],
  ["/ecurie", "Mon écurie"],
  ["/ma-fiche", "Vitrine"],
  ["/demandes", "Demandes"],
  ["/audit", "Audit"],
  ["/apprendre", "Apprendre"],
  ["/argent", "Mon bilan"],
  ["/scenarios", "Et si… ?"],
  ["/client", "Sa fiche"],
  ["/ticket", "Sa fiche"],
  ["/reglages", "Réglages"],
  ["/accueil", "Accueil"],
];
const clean = (p: string) => p.replace(/(.)\/$/, "$1");
export const isRoot2 = (p: string) => ROOTS2.includes(clean(p));
export const parent2 = (p: string) => PARENTS2.find(([m]) => clean(p).startsWith(m))?.[1] ?? "/accueil";
export const nomDe = (href: string) => NOMS.find(([m]) => href.startsWith(m))?.[1] ?? "Accueil";

/** Le retour : toujours le parent, et son nom. */
export function useRetour2() {
  const router = useRouter();
  const path = usePathname() ?? "";
  const ici = useParentIci((s) => s.href);
  // La facture ramène à la fiche de son client ; un groupe de réglages à Mon écurie ou aux Réglages : l'écran le pose.
  const href = (path.startsWith("/facture") || path.startsWith("/moi") || path.startsWith("/parametres") || path.startsWith("/saisie/cheval")) && ici ? ici : parent2(path);
  return { href, nom: nomDe(href), aller: () => router.push(href) };
}

/** Ordinateur : la ligne de retour au-dessus d'un écran qui n'est pas un onglet, avec le nom de l'écran où il mène. */
export function RetourOrdinateur() {
  const path = usePathname() ?? "";
  const retour = useRetour2();
  if (isRoot2(path)) return null;
  return (
    <div className="cn-back-desk">
      <button type="button" onClick={retour.aller}>
        <Ic n="back" />
        {retour.nom}
      </button>
    </div>
  );
}
