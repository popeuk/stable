"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { getSession } from "@/lib/account/session";
import { OBSTACLES, useSettingsStore } from "@/stores/settings-store";

/**
 * Ne jamais rester coincé : chaque écran qui n'est pas un onglet a son
 * retour. Il revient à l'écran d'avant quand on vient de l'app, sinon au
 * parent logique (un ticket ramène aux chevaux, un réglage à « Moi »).
 */
/** Les écrans du bilan : « Voir mon bilan » reste cerné sur chacun. */
export const BILAN = ["/argent", "/pilotage", "/seuil", "/scenarios", "/part", "/prestations"];
/** Les écrans de l'onglet Clients (clients et leurs chevaux). */
export const CLIENTS_CHEVAUX = ["/chevaux", "/clients", "/client", "/ticket", "/cheval", "/facture"];
export const under = (path: string, list: string[]) => list.some((m) => path === m || path.startsWith(m + "/") || path.startsWith(m + "?"));

/**
 * Le parent que l'écran ouvert pose lui-même, quand son adresse ne suffit
 * pas : la facture d'un client ramène à sa fiche.
 */
export const useParentIci = create<{ href: string | null; poser: (href: string | null) => void }>((set) => ({
  href: null,
  poser: (href) => set({ href }),
}));

/* ---------- L'aide de l'écran ---------- */

/**
 * L'aide de l'onglet visible quand un écran en a deux (Clients · Chevaux) :
 * l'écran la pose, et l'enlève en partant.
 */
export const useAideIci = create<{ ici: string | null; poser: (id: string | null) => void }>((set) => ({
  ici: null,
  poser: (id) => set({ ici: id }),
}));
/**
 * La bulle de la première visite et la carte « Comment ça marche ici » :
 * chargées après le premier affichage, avec leurs textes (lib/aide.ts),
 * dans components/bs/aide-carte.tsx.
 */
export const AideCarte = dynamic(() => import("@/components/bs/aide-carte").then((m) => m.AideCarte), { ssr: false });

/** Le titre court d'un écran, pour l'en-tête hors des onglets. */
const TITRES: [string, string][] = [
  ["/valider", "Ce qui est fait"],
  ["/ticket", "Fiche du cheval"],
  ["/part", "Les frais de l’écurie"],
  ["/argent", "Mon bilan"],
  ["/pilotage", "Sur plusieurs mois"],
  ["/seuil", "Combien de chevaux"],
  ["/scenarios", "Et si… ?"],
  ["/clients", "Clients"],
  ["/client", "Fiche client"],
  ["/facturation", "Tes factures"],
  ["/facture", "La facture"],
  ["/contacts", "Les pros"],
  ["/equipe", "Tâches de l’équipe"],
  ["/prestations", "Mes prix"],
  ["/ma-fiche", "Ma fiche mon-ecurie.fr"],
  ["/reglages", "Réglages"],
  ["/moi", "Réglages"],
  ["/parametres", "Réglages"],
  ["/registre", "Registre d’élevage"],
  ["/recherche", "Chercher"],
  ["/saisie/cheval", "Ton cheval"],
];
export const titreDe = (p: string) => TITRES.find(([m]) => p.replace(/(.)\/$/, "$1").startsWith(m))?.[1] ?? "";

/**
 * Le titre principal de l'écran (h1), lu par les lecteurs d'écran : l'en-tête
 * montre le mot-symbole ou un titre court, pas un h1. S'efface si l'écran a
 * déjà son propre h1 (Mon bilan, Clients et chevaux, le seuil...).
 */
const ONGLETS: [string, string][] = [
  ["/accueil", "Accueil"],
  ["/aujourdhui", "Accueil"],
  ["/maintenant", "Accueil"],
  ["/planning", "Planning"],
  ["/chevaux", "Clients"],
  ["/ecurie", "Mon écurie"],
  ["/argent", "Mon bilan"],
  ["/mois", "Mon bilan"],
];
export function TitreEcran() {
  const path = usePathname() ?? "";
  const ref = useRef<HTMLHeadingElement>(null);
  const [autre, setAutre] = useState(false);
  useEffect(() => {
    const main = ref.current?.closest("main");
    if (!main) return;
    const voir = () => setAutre([...main.querySelectorAll("h1")].some((h) => h !== ref.current));
    voir();
    const mo = new MutationObserver(voir);
    mo.observe(main, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [path]);
  return (
    <h1 ref={ref} className="sr-only" hidden={autre}>
      {titreDe(path) || ONGLETS.find(([m]) => path.startsWith(m))?.[1] || "Be Stable"}
    </h1>
  );
}

/* ---------- Le rond : ce qu'on règle rarement ---------- */

export interface PlusItem {
  id: string;
  ic: string;
  label: string;
  sub?: string;
  href?: string;
  run?: () => void;
  badge?: string;
  tone?: "in" | "out" | "attn";
}

/** Le type de session, lu après le montage (le stockage n'existe pas au rendu serveur). */
function useSessionKind() {
  const [kind, setKind] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setKind(getSession()?.kind ?? null), []);
  return kind;
}

/**
 * Les lignes de la barre latérale et de la palette, sur ordinateur, sous
 * « Voir mon bilan » : les réglages, et les premiers pas tant qu'ils ne
 * sont pas finis (en tête, « Créer mon compte » sans compte).
 */
export function usePlusItems(): PlusItem[] {
  const parcours = useSettingsStore((s) => s.parcours);
  const kind = useSessionKind();
  const pas = OBSTACLES.filter((o) => parcours[o]).length;
  const installe = parcours.chevaux && parcours.tarifs && parcours.factures;
  return useMemo(() => [
    ...(kind === "locale" ? [{ id: "garder", ic: "user", label: "Créer mon compte", sub: "Gratuit, avec ton e-mail et un code", href: "/compte/connexion?garder=1", tone: "attn" as const }] : []),
    { id: "reglages", ic: "gear", label: "Réglages", sub: "Compte, rappel, affichage, explications", href: "/reglages" },
    // Sans compte d'étapes : ce qu'il reste à faire, dit simplement.
    ...(pas < 6 ? [{ id: "parcours", ic: "bulb", label: "Tes premiers pas", sub: installe ? "Le reste vient en utilisant l’app" : "Trois questions sur ton écurie", href: "/parcours", tone: "attn" as const }] : []),
  ], [kind, pas, installe]);
}
