"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { Ic } from "@/components/carnet/ui";
import { getSession } from "@/lib/account/session";
import { aideParId, aidePour, type Aide } from "@/lib/aide";
import { OBSTACLES, useSettingsStore } from "@/stores/settings-store";

/**
 * Ne jamais rester coincé : chaque écran qui n'est pas un onglet a son
 * retour. Il revient à l'écran d'avant quand on vient de l'app, sinon au
 * parent logique (un ticket ramène aux chevaux, un réglage à « Moi »).
 */
export const ROOTS = ["/accueil", "/planning", "/equipe", "/chevaux", "/argent"];

/** Les écrans de Mon mois : l'onglet reste allumé sur chacun. */
export const BILAN = ["/argent", "/pilotage", "/seuil", "/scenarios", "/depenses", "/plan", "/audit", "/decouvertes", "/conseiller", "/mois"];
/** Les écrans de l'onglet Clients (clients et leurs chevaux). */
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

/**
 * L'aide de l'onglet visible quand un écran en a deux (Clients · Chevaux) :
 * l'écran la pose, et l'enlève en partant.
 */
export const useAideIci = create<{ ici: string | null; poser: (id: string | null) => void }>((set) => ({
  ici: null,
  poser: (id) => set({ ici: id }),
}));
function useAide() {
  const path = usePathname() ?? "";
  const ici = useAideIci((s) => s.ici);
  return { path, aide: (ici && aideParId(ici)) || aidePour(path) };
}

/** Le « ? » de l'en-tête : rouvre l'aide de l'écran, s'il en a une. */
export function AideBouton({ className = "help" }: { className?: string }) {
  const { aide } = useAide();
  const ouvrir = useAideOuverte((s) => s.ouvrir);
  if (!aide) return null;
  return (
    <button type="button" className={className} aria-label="Comment ça marche ici ?" onClick={() => ouvrir(aide.id)}>
      <Ic n="help" />
    </button>
  );
}

/**
 * La carte « Comment ça marche ici ». Elle s'ouvre toute seule une seule
 * fois en tout, sur l'accueil, compacte et sous le chiffre (compact) ; sur
 * les autres écrans, seulement quand on touche le « ? ».
 */
export function AideCarte({ compact }: { compact?: boolean }) {
  const { path, aide } = useAide();
  const vues = useSettingsStore((s) => s.aidesVues);
  const voir = useSettingsStore((s) => s.voirAide);
  const { ouverte, fermer } = useAideOuverte();
  useEffect(() => fermer(), [path, fermer]);
  if (!aide) return null;
  const demandee = ouverte === aide.id;
  // Sur l'accueil, la carte vit sous le chiffre (compact) : la coque ne la montre pas en tête.
  const ici = clean(path) === "/accueil";
  if (compact !== ici) return null;
  const premiere = compact && vues.length === 0;
  if (!demandee && !premiere) return null;
  const ok = () => {
    voir(aide.id);
    fermer();
  };
  if (compact && !demandee) return <AideLigne aide={aide} ok={ok} />;
  return (
    <section className={`aide${compact ? " compact open" : ""}`} aria-label="Comment ça marche ici">
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

/** L'aide de la première visite, en une ligne qui se déplie. Montrée une fois : en quittant l'écran, elle est vue. */
function AideLigne({ aide, ok }: { aide: Aide; ok: () => void }) {
  const [deplie, setDeplie] = useState(false);
  const voir = useSettingsStore((s) => s.voirAide);
  useEffect(() => () => voir(aide.id), [aide.id, voir]);
  return (
      <section className="aide compact" aria-label="Comment ça marche ici">
        <button type="button" className="aide-l" aria-expanded={deplie} onClick={() => setDeplie(!deplie)}>
          <Ic n="help" className="" />
          <span>Comment ça marche ici ?</span>
          <Ic n="chev" className="chev" />
        </button>
        {deplie && (
          <>
            <ol>
              {aide.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
            <button type="button" className="ok" onClick={ok}>
              J’ai compris
            </button>
          </>
        )}
        <button type="button" className="aide-x" onClick={ok} aria-label="Ne plus montrer l’aide">
          <Ic n="x" className="" />
        </button>
      </section>
  );
}

/** Ordinateur : la ligne de retour au-dessus d'un écran qui n'est pas un onglet. */
export function RetourOrdinateur() {
  const { path, aide } = useAide();
  const retour = useRetour();
  const racine = isRoot(path);
  if (racine && !aide) return null;
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
