"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { Ic } from "@/components/carnet/ui";
import { getSession } from "@/lib/account/session";
import { aidePour } from "@/lib/aide";
import { OBSTACLES, useSettingsStore } from "@/stores/settings-store";

/**
 * Ne jamais rester coincé : chaque écran qui n'est pas un onglet a son
 * retour. Il revient à l'écran d'avant quand on vient de l'app, sinon au
 * parent logique (un ticket ramène aux chevaux, un réglage à « Moi »).
 */
export const ROOTS = ["/accueil", "/planning", "/equipe", "/chevaux", "/argent"];

/** Les écrans de Mon mois : l'onglet reste allumé sur chacun. */
export const BILAN = ["/argent", "/pilotage", "/seuil", "/scenarios", "/depenses", "/plan", "/audit", "/decouvertes", "/conseiller", "/mois"];
/** Les écrans de Clients et chevaux. */
export const CLIENTS_CHEVAUX = ["/chevaux", "/clients", "/client", "/ticket", "/part", "/cheval", "/contacts"];
export const under = (path: string, list: string[]) => list.some((m) => path === m || path.startsWith(m + "/") || path.startsWith(m + "?"));

const PARENTS: [string, string][] = [
  ["/ticket", "/chevaux"],
  ["/part", "/chevaux"],
  ["/valider", "/planning"],
  ["/scenarios/nouveau", "/scenarios"],
  ["/scenarios", "/argent"],
  ["/seuil", "/argent"],
  ["/pilotage", "/argent"],
  ["/depenses", "/argent"],
  ["/parametres", "/moi"],
  ["/saisie", "/accueil"],
];

const clean = (p: string) => p.replace(/(.)\/$/, "$1");
export const isRoot = (p: string) => ROOTS.includes(clean(p));
const parentOf = (p: string) => PARENTS.find(([m]) => clean(p).startsWith(m))?.[1] ?? "/accueil";

/** La pile des écrans visités dans l'app, pour un retour fidèle. */
const pile: string[] = [];

export function useSuiviNavigation() {
  const path = usePathname() ?? "";
  useEffect(() => {
    if (pile[pile.length - 2] === path) pile.pop();
    else if (pile[pile.length - 1] !== path) pile.push(path);
  }, [path]);
}

export function useRetour() {
  const router = useRouter();
  const path = usePathname() ?? "";
  return () => {
    if (pile.length > 1) router.back();
    else router.push(parentOf(path));
  };
}

/* ---------- L'aide de l'écran ---------- */

const useAideOuverte = create<{ ouverte: string | null; ouvrir: (id: string) => void; fermer: () => void }>((set) => ({
  ouverte: null,
  ouvrir: (id) => set({ ouverte: id }),
  fermer: () => set({ ouverte: null }),
}));

/** Le « ? » de l'en-tête : rouvre l'aide de l'écran, s'il en a une. */
export function AideBouton({ className = "help" }: { className?: string }) {
  const path = usePathname() ?? "";
  const aide = aidePour(path);
  const ouvrir = useAideOuverte((s) => s.ouvrir);
  if (!aide) return null;
  return (
    <button type="button" className={className} aria-label="Comment ça marche ici ?" onClick={() => ouvrir(aide.id)}>
      <Ic n="help" />
    </button>
  );
}

/** La carte « Comment ça marche ici », en tête d'écran à la première visite. */
export function AideCarte() {
  const path = usePathname() ?? "";
  const aide = aidePour(path);
  const vues = useSettingsStore((s) => s.aidesVues);
  const voir = useSettingsStore((s) => s.voirAide);
  const { ouverte, fermer } = useAideOuverte();
  useEffect(() => fermer(), [path, fermer]);
  if (!aide) return null;
  if (vues.includes(aide.id) && ouverte !== aide.id) return null;
  const ok = () => {
    voir(aide.id);
    fermer();
  };
  return (
    <section className="aide" aria-labelledby="aide-t">
      <button type="button" className="x" onClick={ok} aria-label="Fermer l’aide">
        <svg viewBox="0 0 24 24">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
      <p className="aide-t" id="aide-t">
        {aide.titre}
      </p>
      <ol>
        {aide.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
      <button type="button" className="ok" onClick={ok}>
        J’ai compris
      </button>
    </section>
  );
}

/** Ordinateur : la ligne de retour au-dessus d'un écran qui n'est pas un onglet. */
export function RetourOrdinateur() {
  const path = usePathname() ?? "";
  const retour = useRetour();
  const racine = isRoot(path);
  if (racine && !aidePour(path)) return null;
  return (
    <div className="cn-back-desk">
      {!racine && (
        <button type="button" onClick={retour}>
          <Ic n="back" />
          Retour
        </button>
      )}
      <AideBouton className="help" />
    </div>
  );
}

/** Le titre court d'un écran, pour l'en-tête hors des onglets. */
const TITRES: [string, string][] = [
  ["/valider", "Ce qui a compté"],
  ["/ticket", "Fiche du cheval"],
  ["/part", "Le pot commun"],
  ["/argent", "Mon mois"],
  ["/pilotage", "Sur plusieurs mois"],
  ["/seuil", "Combien de chevaux"],
  ["/scenarios", "Et si… ?"],
  ["/depenses", "Entrées et sorties"],
  ["/clients", "Mes clients"],
  ["/client", "Fiche client"],
  ["/contacts", "Les pros"],
  ["/equipe", "Tâches de l’équipe"],
  ["/prestations", "Mes tarifs"],
  ["/ma-fiche", "Ma fiche"],
  ["/moi", "Réglages"],
  ["/parametres/equipe", "Mon équipe"],
  ["/parametres", "Tous les réglages"],
  ["/recherche", "Chercher"],
  ["/saisie/cheval", "Ajouter un cheval"],
  ["/saisie", "Noter"],
  ["/decouvertes", "Ce qu’on a remarqué"],
  ["/plan", "Mon plan"],
  ["/audit", "Audit du mois"],
  ["/conseiller", "Pose une question"],
];
export const titreDe = (p: string) => TITRES.find(([m]) => p.replace(/(.)\/$/, "$1").startsWith(m))?.[1] ?? "";

/**
 * Le titre principal de l'écran (h1), lu par les lecteurs d'écran : l'en-tête
 * montre le mot-symbole ou un titre court, pas un h1. S'efface si l'écran a
 * déjà son propre h1 (Mon mois, Clients et chevaux, le seuil...).
 */
const ONGLETS: [string, string][] = [
  ["/accueil", "Accueil"],
  ["/aujourdhui", "Accueil"],
  ["/maintenant", "Accueil"],
  ["/planning", "Planning"],
  ["/chevaux", "Clients et chevaux"],
  ["/ecurie", "Clients et chevaux"],
  ["/mois", "Mon mois"],
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
 * La liste courte du rond en haut à droite au téléphone, et de « Ton
 * écurie » dans la barre latérale sur ordinateur : la fiche, les tarifs,
 * l'équipe, les réglages, et les premiers pas tant qu'ils ne sont pas finis
 * (en tête, « Garder mes chiffres » sans compte). Le reste de l'ancien Menu
 * a trouvé sa place : la loupe de l'en-tête pour chercher, séances à
 * ce qui a compté et tâches en bas du Planning, bilans dans Mon mois,
 * explications, tournée et guide dans Réglages.
 */
export function usePlusItems(): PlusItem[] {
  const parcours = useSettingsStore((s) => s.parcours);
  const kind = useSessionKind();
  const pas = OBSTACLES.filter((o) => parcours[o]).length;
  return useMemo(() => [
    ...(kind === "locale" ? [{ id: "garder", ic: "user", label: "Garder mes chiffres", sub: "Ton e-mail, un code, et tout passe dans ton compte", href: "/compte/connexion?garder=1", tone: "attn" as const }] : []),
    { id: "fiche", ic: "flag", label: "Ma fiche mon-ecurie.fr", sub: "Ce que voient les cavaliers qui cherchent", href: "/ma-fiche" },
    { id: "tarifs", ic: "euro", label: "Mes tarifs", sub: "Pensions, cours, balades, soins refacturés", href: "/prestations" },
    { id: "equipe", ic: "people", label: "Mon équipe", sub: "Qui fait quoi", href: "/parametres/equipe" },
    { id: "reglages", ic: "gear", label: "Réglages", sub: "Écurie, rappel du matin, explications, guide", href: "/moi" },
    ...(pas < 6 ? [{ id: "parcours", ic: "bulb", label: "Mes premiers pas", sub: `${pas} étape${pas > 1 ? "s" : ""} sur 6`, href: "/parcours", badge: `${pas}/6`, tone: "attn" as const }] : []),
  ], [kind, pas]);
}
