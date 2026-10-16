"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { Ic, eur, sg } from "@/components/carnet/ui";
import { aidePour } from "@/lib/aide";
import { OBSTACLES, useSettingsStore } from "@/stores/settings-store";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { toValidate } from "@/lib/domain/seances";
import { billsFor } from "@/lib/domain/billing";
import { suggestions } from "@/lib/domain/leviers";
import { currentPeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";

/**
 * Ne jamais rester coincé : chaque écran qui n'est pas un onglet a son
 * retour. Il revient à l'écran d'avant quand on vient de l'app, sinon au
 * parent logique (un ticket ramène aux chevaux, un réglage à « Moi »).
 */
export const ROOTS = ["/accueil", "/planning", "/chevaux", "/argent"];

/** Les écrans de Mon mois : l'onglet reste allumé sur chacun. */
export const BILAN = ["/argent", "/pilotage", "/seuil", "/scenarios", "/depenses", "/plan", "/audit", "/decouvertes", "/conseiller", "/mois"];
/** Les écrans de Clients et chevaux. */
export const CLIENTS_CHEVAUX = ["/chevaux", "/clients", "/ticket", "/part", "/cheval", "/contacts"];
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
    <section className="aide" aria-label="Comment ça marche ici">
      <button type="button" className="x" onClick={ok} aria-label="Fermer l’aide">
        <svg viewBox="0 0 24 24">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
      <h5>{aide.titre}</h5>
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
  ["/valider", "À confirmer"],
  ["/ticket", "Fiche du cheval"],
  ["/part", "Le pot commun"],
  ["/argent", "Mon mois"],
  ["/pilotage", "Sur plusieurs mois"],
  ["/seuil", "Combien de chevaux"],
  ["/scenarios", "Et si… ?"],
  ["/depenses", "Entrées et sorties"],
  ["/clients", "Mes clients"],
  ["/contacts", "Les pros"],
  ["/equipe", "Tâches de l’équipe"],
  ["/prestations", "Cours et services"],
  ["/ma-fiche", "Ma fiche"],
  ["/moi", "Mon écurie"],
  ["/parametres", "Réglages"],
  ["/recherche", "Chercher"],
  ["/saisie/cheval", "Ajouter un cheval"],
  ["/saisie", "Noter"],
  ["/decouvertes", "Ce qu’on a remarqué"],
  ["/plan", "Mon plan"],
  ["/audit", "Audit du mois"],
  ["/conseiller", "Pose une question"],
];
export const titreDe = (p: string) => TITRES.find(([m]) => p.replace(/(.)\/$/, "$1").startsWith(m))?.[1] ?? "";

/* ---------- Le rond : tout ce que contenait le Menu ---------- */

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
export interface PlusGroup {
  title: string;
  items: PlusItem[];
}

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * Ce qu'on règle rarement, rangé en quatre groupes : le rond en haut à
 * droite au téléphone, « Plus » dans la barre latérale sur ordinateur.
 * Aucune entrée de l'ancien Menu ne disparaît.
 */
export function usePlusGroups(): PlusGroup[] {
  const data = useDataStore();
  const s = useSettingsStore();
  const router = useRouter();
  const openTournee = useUiStore((u) => u.openTournee);
  const c = useMemo(() => {
    const period = currentPeriod();
    const done = data.taskLists?.find((l) => l.isDone)?.id;
    return {
      pending: toValidate(data, localToday(), nowHHMM()).length,
      due: billsFor(data, period).reduce((t, b) => t + Math.max(0, b.due), 0),
      acts: suggestions(data, period, s.capacity).filter((x) => x.status !== "faite" && x.status !== "ecartee").length,
      net: monthBreakdown(data, period).net,
      tasks: (data.tasks ?? []).filter((t) => t.listId !== done).length,
    };
  }, [data, s.capacity]);
  const pas = OBSTACLES.filter((o) => s.parcours[o]).length;
  return [
    {
      title: "Au quotidien",
      items: [
        { id: "valider", ic: "ck", label: "Séances à confirmer", href: "/valider", badge: c.pending ? String(c.pending) : undefined, tone: "attn" },
        { id: "equipe", ic: "board", label: "Tâches de l’équipe", href: "/equipe", badge: c.tasks ? String(c.tasks) : undefined },
        { id: "clients", ic: "people", label: "Mes clients", href: "/clients" },
      ],
    },
    {
      title: "Ton argent",
      items: [
        { id: "bilan", ic: "euro", label: "Bilan du mois", href: "/argent", badge: sg(c.net), tone: c.net >= 0 ? "in" : "out" },
        { id: "leviers", ic: "bulb", label: "Pistes pour gagner plus", href: "/argent?vue=leviers", badge: c.acts ? String(c.acts) : undefined },
        { id: "facturer", ic: "doc", label: "À facturer", href: "/argent?vue=facturer", badge: c.due ? eur(c.due) : undefined },
        { id: "mouvements", ic: "list", label: "Entrées et sorties d’argent", href: "/argent?vue=mouvements" },
        { id: "pilotage", ic: "chart", label: "Sur plusieurs mois", href: "/pilotage" },
      ],
    },
    {
      title: "Ton écurie",
      items: [
        { id: "fiche", ic: "flag", label: "Ma fiche mon-ecurie.fr", sub: "Les cavaliers cherchent leur pension. Une photo et tes places libres : c’est ce qu’ils regardent en premier.", href: "/ma-fiche" },
        { id: "prestations", ic: "hay", label: "Mes cours, services et prix", href: "/prestations" },
        { id: "moi", ic: "gear", label: "Mon écurie et mes réglages", href: "/moi" },
      ],
    },
    {
      title: "Besoin d’aide ?",
      items: [
        { id: "tournee", ic: "clock", label: "Revoir la tournée du matin", run: () => (router.push("/accueil"), openTournee()) },
        ...(pas < 6 ? [{ id: "parcours", ic: "flag", label: "Mes premiers pas", href: "/parcours", badge: `${pas}/6`, tone: "attn" as const }] : [{ id: "parcours", ic: "flag", label: "Mes premiers pas", href: "/parcours" }]),
        { id: "aides", ic: "help", label: "Revoir les explications de chaque écran", run: () => s.revoirAides() },
        { id: "guide", ic: "doc", label: "Le guide, la communauté, l’annuaire", href: "/moi#bestable" },
      ],
    },
  ];
}
