"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { Ic } from "@/components/carnet/ui";
import { getSession } from "@/lib/account/session";
import { aideParId, aidePour, bulleAMontrer, placerBulle, type CibleBulle } from "@/lib/aide";
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
const clean = (p: string) => p.replace(/(.)\/$/, "$1");
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
export function useAide() {
  const path = usePathname() ?? "";
  const ici = useAideIci((s) => s.ici);
  // L'onglet visible d'abord ; sinon l'adresse, avec son ?vue= (Clients ou Chevaux), lue dans le navigateur.
  const search = typeof window === "undefined" ? "" : window.location.search;
  return { path, aide: (ici && aideParId(ici)) || aidePour(path + search) };
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
 * La carte « Comment ça marche ici » : tous les points de l'écran, à la
 * demande seulement (le « ? » de l'en-tête). Sur l'accueil, elle vit sous le
 * chiffre (compact) ; ailleurs, en tête de l'écran. Rien ne s'ouvre tout
 * seul : à la première visite, c'est la bulle qui montre (AideBulle).
 */
export function AideCarte({ compact }: { compact?: boolean }) {
  const { path, aide } = useAide();
  const voir = useSettingsStore((s) => s.voirAide);
  const { ouverte, fermer } = useAideOuverte();
  useEffect(() => fermer(), [path, fermer]);
  // La bulle de la première visite part de la coque (l'instance en tête d'écran), une seule fois.
  const bulle = compact ? null : <AideBulle />;
  if (!aide) return bulle;
  // Sur l'accueil, la carte vit sous le chiffre (compact) : la coque ne la montre pas en tête.
  const ici = clean(path) === "/accueil";
  if (!!compact !== ici || ouverte !== aide.id) return bulle;
  const ok = () => {
    voir(aide.id);
    fermer();
  };
  return (
    <>
      {bulle}
      <section className={`aide${compact ? " compact open" : ""}`} aria-labelledby="aide-t">
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
    </>
  );
}

/** Les cibles de la bulle, la première visible gagne : téléphone d'abord, puis ordinateur. */
const CIBLES: Record<CibleBulle, string[]> = {
  plus: [".tb .plus", ".cn-side .add"],
  haut: [".hd .help", ".cn-back-desk .help"],
};
const visible = (el: Element | null): el is HTMLElement => {
  if (!(el instanceof HTMLElement)) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
};
function trouverCible(cible: CibleBulle): HTMLElement | null {
  // Pas de + à l'écran : la bulle se pose sous l'en-tête.
  const liste = cible === "plus" ? [...CIBLES.plus, ...CIBLES.haut] : CIBLES.haut;
  for (const sel of liste) {
    const el = document.querySelector(sel);
    if (visible(el)) return el;
  }
  return null;
}
/** Une feuille, un menu, une tournée ou un message du bas ouverts : la bulle attend. */
const occupe = () => !!document.querySelector('.sheet-wrap.open, [role="dialog"][aria-modal="true"], .toast');

/**
 * La bulle de la première visite d'un écran : une phrase courte, fond encre,
 * posée près de l'élément utile (le +, ou le « ? » de l'en-tête), avec une
 * petite pointe. Elle part au premier toucher, n'importe où, et ce toucher
 * fait son effet normal : la bulle ne capte rien (pointer-events: none) et
 * ne couvre jamais le +. Vue une fois, elle ne revient plus pour cet écran
 * (la même mémoire que la carte : aidesVues ; « Revoir les explications »
 * dans Réglages la fait revenir).
 */
export function AideBulle() {
  const { path, aide } = useAide();
  const vues = useSettingsStore((s) => s.aidesVues);
  const voir = useSettingsStore((s) => s.voirAide);
  const ouverte = useAideOuverte((s) => s.ouverte);
  const a = bulleAMontrer(aide, vues, ouverte);
  const [prete, setPrete] = useState<string | null>(null);
  const [pos, setPos] = useState<ReturnType<typeof placerBulle> | null>(null);
  // Au téléphone, une bulle du haut cacherait le titre de l'écran : elle se pose en bas, au-dessus de la barre, sans pointe.
  const [enBas, setEnBas] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = a?.id ?? null;
  const cible = a?.cible ?? "haut";

  // Un temps pour que l'écran se pose (et les réglages enregistrés soient relus), puis la bulle, si rien n'est ouvert.
  useEffect(() => {
    if (!id) return;
    let t: ReturnType<typeof setTimeout>;
    const essayer = () => {
      const relus = useSettingsStore.persist?.hasHydrated?.() ?? true;
      if (!relus || occupe() || !trouverCible(cible)) t = setTimeout(essayer, 600);
      else setPrete(id);
    };
    t = setTimeout(essayer, 700);
    return () => {
      clearTimeout(t);
      setPrete(null);
      setPos(null);
    };
  }, [id, cible, path]);

  const montree = !!id && prete === id;

  // La poser près de sa cible, et la suivre si l'écran bouge.
  useLayoutEffect(() => {
    if (!montree) return;
    const placer = () => {
      const barre = cible === "haut" ? document.querySelector(CIBLES.plus[0]) : null;
      const bas = visible(barre);
      const el = bas ? barre : trouverCible(cible);
      const b = ref.current;
      setEnBas(bas);
      if (!el || !b) return setPos(null);
      setPos(placerBulle(el.getBoundingClientRect(), { width: b.offsetWidth }, { width: window.innerWidth, height: window.innerHeight }));
    };
    placer();
    window.addEventListener("resize", placer);
    window.addEventListener("scroll", placer, { passive: true, capture: true });
    return () => {
      window.removeEventListener("resize", placer);
      window.removeEventListener("scroll", placer, { capture: true });
    };
  }, [montree, cible]);

  // Le premier toucher (ou une touche du clavier) la fait partir, sans rien empêcher.
  useEffect(() => {
    if (!montree || !id) return;
    const partir = () => {
      voir(id);
      setPrete(null);
    };
    window.addEventListener("pointerdown", partir, { capture: true, passive: true });
    window.addEventListener("keydown", partir, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", partir, { capture: true });
      window.removeEventListener("keydown", partir, { capture: true });
    };
  }, [montree, id, voir]);

  if (!montree || !a) return null;
  return createPortal(
    <div className="carnet carnet-portal">
      <div
        ref={ref}
        className={`aide-bulle${pos ? (pos.dessus ? " dessus" : " dessous") : ""}${enBas ? " sans-pointe" : ""}`}
        role="status"
        aria-live="polite"
        style={pos ? { left: pos.left, top: pos.top, bottom: pos.bottom, ["--pointe" as string]: `${pos.pointe}px` } : { visibility: "hidden" }}
      >
        {a.texte}
      </div>
    </div>,
    document.body,
  );
}

/** Le titre court d'un écran, pour l'en-tête hors des onglets. */
const TITRES: [string, string][] = [
  ["/valider", "Ce qui est fait"],
  ["/ticket", "Fiche du cheval"],
  ["/part", "Les frais de l’écurie"],
  ["/argent", "Mon bilan"],
  ["/pilotage", "Sur plusieurs mois"],
  ["/seuil", "Combien de chevaux"],
  ["/scenarios", "Et si… ?"],
  ["/clients", "Mes clients"],
  ["/client", "Fiche client"],
  ["/facturation", "Factures"],
  ["/facture", "Facture"],
  ["/contacts", "Les pros"],
  ["/equipe", "Tâches de l’équipe"],
  ["/prestations", "Mes prix"],
  ["/ma-fiche", "Ma fiche"],
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
 * déjà son propre h1 (Mon mois, Clients et chevaux, le seuil...).
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
 * sont pas finis (en tête, « Garder mes chiffres » sans compte).
 */
export function usePlusItems(): PlusItem[] {
  const parcours = useSettingsStore((s) => s.parcours);
  const kind = useSessionKind();
  const pas = OBSTACLES.filter((o) => parcours[o]).length;
  const installe = parcours.chevaux && parcours.tarifs && parcours.factures;
  return useMemo(() => [
    ...(kind === "locale" ? [{ id: "garder", ic: "user", label: "Garder mes chiffres", sub: "Le nom de ton écurie, ton e-mail, un code", href: "/compte/connexion?garder=1", tone: "attn" as const }] : []),
    { id: "reglages", ic: "gear", label: "Réglages", sub: "Compte, rappel, affichage, explications", href: "/reglages" },
    // Sans compte d'étapes : ce qu'il reste à faire, dit simplement.
    ...(pas < 6 ? [{ id: "parcours", ic: "bulb", label: "Tes premiers pas", sub: installe ? "Le reste vient en utilisant l’app" : "Trois questions sur ton écurie", href: "/parcours", tone: "attn" as const }] : []),
  ], [kind, pas, installe]);
}
