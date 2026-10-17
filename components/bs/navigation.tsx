"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAide, useParentIci } from "@/components/bs/nav";
import { Ic } from "@/components/carnet/ui";

/**
 * La navigation (17 octobre 2026) : quatre onglets (Accueil, Planning,
 * Clients, Mon écurie) et le +, « Voir mon bilan » et la roue des réglages
 * en haut à droite. Chaque écran a un seul parent, et le retour y mène
 * toujours en disant son nom, quel que soit le chemin pris pour venir.
 */
/** Les quatre onglets : ils n'ont pas de retour. */
export const ROOTS2 = ["/accueil", "/planning", "/chevaux", "/ecurie"];
/** Les écrans de Mon écurie : l'onglet reste allumé. */
export const ECURIE = ["/ecurie", "/parcours/tarifs", "/parcours/factures", "/contacts", "/ma-fiche", "/facturation", "/registre"];

/** Chaque écran a un seul parent, quel que soit le chemin pris pour y venir. */
const PARENTS2: [string, string][] = [
  ["/ticket", "/chevaux?vue=chevaux"],
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
  ["/moi", "/reglages"],
  ["/parametres", "/reglages"],
  ["/contacts", "/ecurie"],
  ["/ma-fiche", "/ecurie"],
  ["/facturation", "/ecurie"],
  ["/registre", "/ecurie"],
];
const NOMS: [string, string][] = [
  ["/chevaux", "Clients"],
  ["/planning", "Planning"],
  ["/ecurie", "Mon écurie"],
  ["/argent", "Mon bilan"],
  ["/scenarios", "Et si… ?"],
  ["/client", "Sa fiche"],
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
  const href = (path.startsWith("/facture") || path.startsWith("/moi") || path.startsWith("/parametres")) && ici ? ici : parent2(path);
  return { href, nom: nomDe(href), aller: () => router.push(href) };
}

/** Ordinateur : la ligne de retour au-dessus d'un écran qui n'est pas un onglet, avec le nom de l'écran où il mène. */
export function RetourOrdinateur() {
  const { path } = useAide();
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
