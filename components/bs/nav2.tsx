"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useParentIci } from "@/components/bs/nav";

/**
 * Proposition de navigation (17 octobre 2026), derrière ?nav=2 (gardée le
 * temps de la visite, ?nav=0 pour revenir) : la barre du bas finit sur
 * « Mon écurie », le bilan et les réglages passent en haut à droite, et le
 * retour mène toujours au même parent, qu'il nomme.
 */
const CLE = "be-stable-nav";
const abonnes = new Set<() => void>();
const lire = () => {
  try {
    return sessionStorage.getItem(CLE) === "2";
  } catch {
    return false;
  }
};
export function useNav2() {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    lire,
    () => false,
  );
}

/** Lit ?nav= une fois par écran. */
export function NavParam() {
  const v = useSearchParams().get("nav");
  useEffect(() => {
    if (v !== "2" && v !== "0") return;
    try {
      if (v === "2") sessionStorage.setItem(CLE, "2");
      else sessionStorage.removeItem(CLE);
    } catch {
      /* Sans stockage : rien. */
    }
    abonnes.forEach((f) => f());
  }, [v]);
  return null;
}

/** Les quatre onglets : ils n'ont pas de retour. */
export const ROOTS2 = ["/accueil", "/planning", "/chevaux", "/ecurie"];
/** Les écrans de Mon écurie : l'onglet reste allumé. */
export const ECURIE = ["/ecurie", "/parcours/tarifs", "/parcours/factures", "/moi", "/prestations", "/contacts", "/ma-fiche", "/facturation", "/registre", "/parametres"];

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
  ["/argent", "/accueil"],
  ["/reglages", "/accueil"],
  ["/moi", "/ecurie"],
  ["/parametres", "/ecurie"],
  ["/prestations", "/ecurie"],
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
  ["/accueil", "Accueil"],
];
const clean = (p: string) => p.replace(/(.)\/$/, "$1");
export const isRoot2 = (p: string) => ROOTS2.includes(clean(p));
export const parent2 = (p: string) => PARENTS2.find(([m]) => clean(p).startsWith(m))?.[1] ?? "/accueil";
export const nomDe = (href: string) => NOMS.find(([m]) => href.startsWith(m))?.[1] ?? "Accueil";

/** Le retour de la proposition : toujours le parent (la fiche du client pour une facture). */
export function useRetour2() {
  const router = useRouter();
  const path = usePathname() ?? "";
  const ici = useParentIci((s) => s.href);
  const href = path.startsWith("/facture") && ici ? ici : parent2(path);
  return { href, nom: nomDe(href), aller: () => router.push(href) };
}
