"use client";

import { ECURIE, isRoot2, useRetour2 } from "@/components/bs/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CountUp, Ic, eur } from "@/components/carnet/ui";
import { resteOuManque } from "@/lib/domain/lecture";
import { useUiStore } from "@/stores/ui-store";
import { useDataStore } from "@/stores/data-store";
import { estEstimation } from "@/lib/domain/estimation";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";
import { useFinDuMois } from "@/components/bs/compte";
import { BILAN, CLIENTS_CHEVAUX, under, useParentIci } from "@/components/bs/nav";

/**
 * L'en-tête : à gauche « be stable » sur les onglets, sinon le retour, qui
 * dit où il mène ; à droite « Voir mon bilan » et le chiffre du mois (un
 * « +X € » s'envole quand de l'argent rentre), puis la roue des réglages.
 */
export function Header() {
  const path = usePathname() ?? "";
  const retour = useRetour2();
  const net = useNet();
  const estime = useEstime();
  const ready = useDataStore((s) => s.hydrated);
  const tone = estime ? "" : Math.round(net) > 0 ? "in" : Math.round(net) < 0 ? "out" : "";
  const gain = useGain(net, ready);
  return (
    <header className="hd hd2">
      {isRoot2(path) ? (
        <Link href="/accueil" className="wm">
          be stable
        </Link>
      ) : (
        <Link href={retour.href} className="hd2-back" onClick={(e) => (e.preventDefault(), retour.aller())}>
          <Ic n="back" />
          {retour.nom}
        </Link>
      )}
      <span className="hd2-sp" />
      <Link href="/argent" className="hd2-bilan" aria-current={under(path, BILAN) ? "page" : undefined} aria-label={`Voir mon bilan : ${resteOuManque(net)} ${eur(Math.abs(net))}`}>
        <span>Voir mon bilan</span>
        <b className={`num ${tone}`}>{ready ? <CountUp value={Math.round(net)} ms={700} /> : "…"}</b>
        {gain > 0 && (
          <span className="chip-fly hd2-fly" aria-hidden="true">
            +{gain} €
          </span>
        )}
      </Link>
      <Link href="/reglages" className="hd2-gear" aria-current={path.startsWith("/reglages") ? "page" : undefined} aria-label="Réglages de l’app">
        <Ic n="gear" />
      </Link>
    </header>
  );
}

/** Ce qui vient de rentrer, pour le « +X € » qui s'envole ; le chargement des données n'est pas un gain. */
function useGain(net: number, ready: boolean) {
  const avant = useRef(net);
  const pret = useRef(ready);
  const [gain, setGain] = useState(0);
  useEffect(() => {
    const d = Math.round(net - avant.current);
    avant.current = net;
    const etaitPret = pret.current;
    pret.current = ready;
    if (!ready || !etaitPret || d <= 0) return;
    setGain(d);
    const t = setTimeout(() => setGain(0), 1400);
    return () => clearTimeout(t);
  }, [net, ready]);
  return gain;
}

/** Le chiffre net du mois, pour « Voir mon bilan ». */
function useNet() {
  const data = useDataStore();
  return useMemo(() => monthBreakdown(data, currentPeriod()).net, [data]);
}
/** Le chiffre du mois n'est qu'une estimation (écurie neuve) : à l'encre. */
function useEstime() {
  const data = useDataStore();
  return useMemo(() => estEstimation(data, currentPeriod()), [data]);
}

/**
 * La barre d'onglets : Accueil, Planning, +, Clients (les clients et leurs
 * chevaux ; en fin de mois seulement, le nombre de clients qui te doivent
 * encore) et Mon écurie (ce qu'elle vend, ce qu'elle paie, ses gens, ses papiers).
 */
export function TabBar() {
  const path = usePathname() ?? "";
  const openNoter = useUiStore((s) => s.openNoter);
  const ready = useDataStore((s) => s.hydrated);
  const fin = useFinDuMois();
  const count = ready && fin ? fin.count : 0;
  const on = (list: string[]) => (under(path, list) ? "page" : undefined);
  // Mes places, Mon équipe, Mes papiers : leur page pose Mon écurie comme parent, l'onglet suit.
  const parentIci = useParentIci((x) => x.href);
  const surEcurie = under(path, ECURIE) || (path.startsWith("/moi") && parentIci === "/ecurie");
  return (
    <nav className="tb ac-tb" aria-label="Navigation principale">
      <div>
        <Link href="/accueil" aria-current={on(["/accueil"])}>
          <Ic n="home" />
          Accueil
        </Link>
        <Link href="/planning" aria-current={on(["/planning", "/valider", "/equipe"])}>
          <Ic n="cal" />
          Planning
        </Link>
        <button
          type="button"
          className="plus"
          aria-label="Noter une séance, un soin, une tâche ou de l’argent"
          onClick={() => {
            const id = path.startsWith("/ticket") ? new URLSearchParams(window.location.search).get("id") : null;
            openNoter(id ? { horseIds: [id] } : {});
          }}
        >
          <Ic n="plus" />
        </button>
        <Link href="/chevaux" aria-current={on(CLIENTS_CHEVAUX)} aria-label={`Clients${count ? ` : ${count} client${count > 1 ? "s" : ""} à faire payer` : ""}`}>
          <span className="ac-ic">
            <Ic n="people" />
            {count > 0 && (
              <em className="ac-badge" aria-hidden="true">
                {count}
              </em>
            )}
          </span>
          <span aria-hidden="true">Clients</span>
        </Link>
        <Link href="/ecurie" aria-current={surEcurie ? "page" : undefined}>
          <Ic n="horse" />
          Mon écurie
        </Link>
      </div>
    </nav>
  );
}

/** Ce que le message ne doit jamais couvrir : la barre du bas, les pieds d'action, le bandeau « Garde-les ». */
const PIEDS = ".tb, .foot, .es-keep, .nt-stick, .ch-stick, .sheet .btn.full";

/**
 * Le message du bas (« Étape franchie », « Annuler »). Il se pose au-dessus
 * du plus haut pied d'action visible en bas de l'écran : il ne recouvre
 * jamais un bouton.
 */
/**
 * Le message d'une action faite : court, sur une ligne, avec sa croix.
 * `haut` (premiers pas, bienvenue : pas de barre en bas) : posé en haut, il ne
 * bouge plus. Ailleurs, posé une fois au-dessus du pied d'action, sans suivre
 * l'écran qui change sous lui (il sautait d'un écran à l'autre).
 */
export function ToastHost({ haut = false }: { haut?: boolean }) {
  const toast = useUiStore((s) => s.toast);
  const dismiss = useUiStore((s) => s.dismiss);
  const [bas, setBas] = useState<number | null>(null);
  useEffect(() => {
    if (!toast || haut) return;
    const placer = () => {
      const h = window.innerHeight;
      let top = h;
      document.querySelectorAll<HTMLElement>(PIEDS).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || r.bottom <= h * 0.45 || r.top >= h) return;
        top = Math.min(top, r.top);
      });
      setBas(top < h ? h - top + 10 : null);
    };
    const raf = requestAnimationFrame(placer);
    window.addEventListener("resize", placer);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", placer);
    };
  }, [toast, haut]);
  if (!toast) return null;
  return (
    <div className={`toast${haut ? " haut" : ""}`} role="status" aria-live="polite" key={toast.id} style={!haut && bas != null ? { bottom: bas } : undefined}>
      <p dangerouslySetInnerHTML={{ __html: toast.html }} />
      {toast.undo && (
        <button
          type="button"
          className="toast-undo"
          onClick={() => {
            toast.undo?.();
            dismiss();
          }}
        >
          Annuler
        </button>
      )}
      <button type="button" className="toast-x" onClick={dismiss} aria-label="Fermer le message">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
