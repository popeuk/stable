"use client";

import { isRoot2, useRetour2 } from "@/components/bs/navigation";
import { useBriques } from "@/components/bs/briques";
import "@/app/carnet/briques.css";
import { estOuverte } from "@/lib/briques";
import { nonVues, useDemandes } from "@/lib/account/demandes";
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
import { BILAN, CLIENTS_CHEVAUX, under } from "@/components/bs/nav";


/**
 * L'en-tête : à gauche « be stable » sur les onglets, sinon le retour, qui
 * dit où il mène ; à droite « Voir mon bilan » et le chiffre du mois (un
 * « +X € » s'envole quand de l'argent rentre), puis la roue des réglages.
 */
/**
 * Quand l'en-tête ne tient pas sur la largeur (Gros texte, retour long comme
 * « Mon écurie », gros chiffre, enveloppe), « Voir mon bilan » laisse sa
 * place au seul chiffre (le bouton garde son nom pour la lecture vocale),
 * au lieu de pousser la roue hors de l'écran.
 */
function useSerre() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const h = ref.current;
    if (!h || typeof ResizeObserver === "undefined") return;
    const mesurer = () => {
      h.classList.remove("serre");
      if (h.scrollWidth > h.clientWidth + 1) h.classList.add("serre");
    };
    const ro = new ResizeObserver(mesurer);
    ro.observe(h);
    const mo = new MutationObserver(() => {
      for (const c of Array.from(h.children)) ro.observe(c);
      mesurer();
    });
    mo.observe(h, { childList: true, subtree: true, characterData: true });
    for (const c of Array.from(h.children)) ro.observe(c);
    mesurer();
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);
  return ref;
}

export function Header() {
  const path = usePathname() ?? "";
  const retour = useRetour2();
  const net = useNet();
  const estime = useEstime();
  const ready = useDataStore((s) => s.hydrated);
  const tone = estime ? "" : Math.round(net) > 0 ? "in" : Math.round(net) < 0 ? "out" : "";
  const gain = useGain(net, ready);
  const hdRef = useSerre();
  // Rien de payant ne s'affiche en haut pour un compte gratuit : Mon bilan vient avec Mon argent (lib/briques.ts).
  const argent = estOuverte(useBriques().etat.argent);
  return (
    <header className="hd hd2" ref={hdRef}>
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
      {argent && (
      <Link href="/argent" className="hd2-bilan" aria-current={under(path, BILAN) ? "page" : undefined} aria-label={`Mon bilan : ${resteOuManque(net)} ${eur(Math.abs(net))}`}>
        <span>Mon bilan</span>
        <b className={`num ${tone}`}>{ready ? <CountUp value={Math.round(net)} ms={700} /> : "…"}</b>
        {gain > 0 && (
          <span className="chip-fly hd2-fly" aria-hidden="true">
            {`+${gain}\u00a0€`}
          </span>
        )}
      </Link>
      )}
      <Link href="/reglages" className="hd2-gear" aria-current={path.startsWith("/reglages") ? "page" : undefined} aria-label="Réglages">
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
 * La barre d'onglets (27 octobre 2026) : Accueil, Vitrine, +, Demandes, Clients.
 * Les places ne bougent jamais, quelle que soit l'offre, pour ne pas perdre le
 * gérant. Demandes est gratuit et compte les demandes pas encore vues ; Clients
 * porte un cadenas tant que Mon argent n'est pas ouvert (lib/briques.ts).
 */
export function TabBar() {
  const path = usePathname() ?? "";
  const openNoter = useUiStore((s) => s.openNoter);
  const ready = useDataStore((s) => s.hydrated);
  const fin = useFinDuMois();
  const { etat } = useBriques();
  const argent = estOuverte(etat.argent);
  const count = ready && fin && argent ? fin.count : 0;
  const charger = useDemandes((s) => s.charger);
  const demandes = useDemandes((s) => (s.etat === "pret" ? nonVues(s.demandes, s.vuesIci) : 0));
  useEffect(() => {
    void charger();
  }, [charger, path]);
  const on = (list: string[]) => (under(path, list) ? "page" : undefined);
  return (
    // Le + note ce qui fait Mon argent (séances, soins, argent) : sans cette brique, pas de + (barre à quatre).
    <nav className={`tb ac-tb bq-tb${argent ? "" : " sans-plus"}`} aria-label="Navigation principale">
      <div>
        <Link href="/accueil" aria-current={on(["/accueil"])}>
          <Ic n="home" />
          Accueil
        </Link>
        <Link href="/ma-fiche" aria-current={on(["/ma-fiche", "/mon-site"])}>
          <Ic n="vitrine" />
          Vitrine
        </Link>
        {argent && (
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
        )}
        <Link href="/demandes" aria-current={on(["/demandes"])} aria-label={`Demandes${demandes ? ` : ${demandes} nouvelle${demandes > 1 ? "s" : ""}` : ""}`}>
          <span className="ac-ic">
            <Ic n="inbox" />
            {demandes > 0 && (
              <em className="ac-badge" aria-hidden="true">
                {demandes}
              </em>
            )}
          </span>
          <span aria-hidden="true">Demandes</span>
        </Link>
        <Link href="/chevaux" aria-current={on(CLIENTS_CHEVAUX)} aria-label={`Clients${argent ? "" : " : avec Mon argent"}${count ? ` : ${count} client${count > 1 ? "s" : ""} à faire payer` : ""}`}>
          <span className="ac-ic">
            <Ic n="people" />
            {count > 0 && (
              <em className="ac-badge" aria-hidden="true">
                {count}
              </em>
            )}
            {!argent && (
              <i className="bq-lk" aria-hidden="true">
                <Ic n="lock" className="" />
              </i>
            )}
          </span>
          <span aria-hidden="true">Clients</span>
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
