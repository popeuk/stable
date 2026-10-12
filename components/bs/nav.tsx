"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { create } from "zustand";
import { Picto } from "@/components/bs/picto";
import { aidePour } from "@/lib/aide";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * Ne jamais rester coincé : chaque écran qui n'est pas un onglet a son
 * retour. Il revient à l'écran d'avant quand on vient de l'app, sinon au
 * parent logique (un ticket ramène aux chevaux, un réglage à « Moi »).
 */
export const ROOTS = ["/accueil", "/planning", "/chevaux"];

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
export function AideBouton({ className = "bs-icon" }: { className?: string }) {
  const path = usePathname() ?? "";
  const aide = aidePour(path);
  const ouvrir = useAideOuverte((s) => s.ouvrir);
  if (!aide) return null;
  return (
    <button type="button" className={className} aria-label="Comment ça marche ici ?" onClick={() => ouvrir(aide.id)}>
      <Picto name="aide" />
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
    <section className="bs-aide" aria-label="Comment ça marche ici">
      <button type="button" className="bs-aide-x" onClick={ok} aria-label="Fermer l’aide">
        <Picto name="x" />
      </button>
      <h2>{aide.titre}</h2>
      <ol>
        {aide.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
      <button type="button" className="bs-aide-ok" onClick={ok}>
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
    <div className="bs-retour-desk">
      {!racine && (
        <button type="button" onClick={retour}>
          <Picto name="back" />
          Retour
        </button>
      )}
      <AideBouton className="bs-retour-aide" />
    </div>
  );
}
