"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { CountUp, Ic, sg } from "@/components/carnet/ui";
import { useUiStore } from "@/stores/ui-store";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { estEstimation } from "@/lib/domain/estimation";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";
import { useFinDuMois } from "@/components/bs/compte";
import { AideBouton, BILAN, CLIENTS_CHEVAUX, isRoot, titreDe, under, usePlusItems, useRetour, useSuiviNavigation, type PlusItem } from "@/components/bs/nav";

/** L'initiale du gérant, pour le rond en haut à droite. */
export function useInitiale() {
  const gerant = useSettingsStore((s) => s.gerant);
  const stableName = useSettingsStore((s) => s.stableName);
  return ((gerant || stableName || "?").trim()[0] ?? "?").toUpperCase();
}

/**
 * L'en-tête du carnet : be stable et l'écurie sur les onglets, sinon le
 * retour et le titre de l'écran ; l'aide quand l'écran en a une ; et le
 * rond à l'initiale du gérant, qui ouvre tout ce qu'on règle rarement.
 */
export function Header() {
  const stableName = useSettingsStore((s) => s.stableName);
  const path = usePathname() ?? "";
  const retour = useRetour();
  const ini = useInitiale();
  const [rond, setRond] = useState(false);
  useSuiviNavigation();
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setRond(false), [path]);
  return (
    <header className="hd">
      {isRoot(path) ? (
        <>
          <Link href="/accueil" className="wm">
            be stable
          </Link>
          <span className="stb">· {stableName}</span>
        </>
      ) : (
        <>
          <button type="button" className="back" onClick={retour} aria-label="Revenir en arrière">
            <Ic n="back" />
          </button>
          <span className="ttl">{path.startsWith("/ticket") ? <Suspense fallback={titreDe(path)}><TitreCheval /></Suspense> : titreDe(path)}</span>
        </>
      )}
      {!path.startsWith("/recherche") && (
        <Link href="/recherche" className="ac-srch" aria-label="Chercher un cheval, un client">
          <Ic n="search" />
        </Link>
      )}
      <AideBouton className="help" />
      <button type="button" className="ac-me" onClick={() => setRond(true)} aria-haspopup="dialog" aria-expanded={rond} aria-label="Ta fiche, tes tarifs, ton équipe, tes réglages">
        <span aria-hidden="true">{ini}</span>
      </button>
      {/* La feuille sort de l'en-tête : sur iPhone, une barre floutée l'enfermerait dedans. */}
      {rond && createPortal(<RondSheet onClose={() => setRond(false)} />, document.body)}
    </header>
  );
}

/** Une ligne du rond ou de « Plus » : un lien, ou une action. */
export function PlusLigne({ it, onDone, sub = true }: { it: PlusItem; onDone?: () => void; sub?: boolean }) {
  const body = (
    <>
      <Ic n={it.ic} />
      <span className="ac-itx">
        <b>{it.label}</b>
        {sub && it.sub && <small>{it.sub}</small>}
      </span>
      {it.badge ? <em className={it.tone ?? ""}>{it.badge}</em> : <Ic n="chev" className="chev" />}
    </>
  );
  if (it.href)
    return (
      <Link href={it.href} className="ac-it" onClick={onDone}>
        {body}
      </Link>
    );
  return (
    <button
      type="button"
      className="ac-it"
      onClick={() => {
        it.run?.();
        onDone?.();
      }}
    >
      {body}
    </button>
  );
}

/**
 * La feuille du rond : le prénom et l'écurie, puis une liste courte (fiche,
 * tarifs, équipe, réglages, premiers pas tant qu'ils ne sont pas finis).
 */
export function RondSheet({ onClose }: { onClose: () => void }) {
  const s = useSettingsStore();
  const ini = useInitiale();
  const items = usePlusItems();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    // La page ne défile pas derrière la feuille ouverte.
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = avant;
    };
  }, [onClose]);
  return (
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet ac-rond" role="dialog" aria-modal="true" aria-labelledby="ac-rond-t" ref={ref} tabIndex={-1}>
          <div className="grab" />
          <div className="shd">
            <span className="ac-mehd">
              <span className="ac-me" aria-hidden="true">
                <span>{ini}</span>
              </span>
              <span>
                <b id="ac-rond-t">{s.gerant || "Ton écurie"}</b>
                {s.stableName && <small>{s.stableName}</small>}
              </span>
            </span>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          <div className="pad ac-list">
            {items.map((it) => (
              <PlusLigne key={it.id} it={it} onDone={onClose} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Le chiffre net du mois, pour l'onglet Mon mois. */
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
 * La barre d'onglets : Accueil, Planning, +, Clients (les clients et leurs chevaux ; en fin de
 * mois seulement, le nombre de clients qui te doivent encore), Mon mois (le chiffre du mois, qui compte quand il
 * change, et un « +X € » qui s'envole quand de l'argent rentre).
 */
export function TabBar() {
  const path = usePathname() ?? "";
  const openNoter = useUiStore((s) => s.openNoter);
  const ready = useDataStore((s) => s.hydrated);
  const fin = useFinDuMois();
  const count = ready && fin ? fin.count : 0;
  const net = useNet();
  const avant = useRef(net);
  const [gain, setGain] = useState(0);
  const pret = useRef(ready);
  useEffect(() => {
    const d = Math.round(net - avant.current);
    avant.current = net;
    // Le chargement des données n'est pas un gain.
    const etaitPret = pret.current;
    pret.current = ready;
    if (!ready || !etaitPret || d <= 0) return;
    setGain(d);
    const t = setTimeout(() => setGain(0), 1400);
    return () => clearTimeout(t);
  }, [net, ready]);
  const on = (list: string[]) => (under(path, list) ? "page" : undefined);
  const estime = useEstime();
  const tone = estime ? "" : Math.round(net) > 0 ? "in" : Math.round(net) < 0 ? "out" : "";
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
        <Link href="/argent" aria-current={on(BILAN)} aria-label={`Mon mois : ${net < 0 ? "il te manque" : "il te reste"} ${sg(net)}`} className="ac-mois">
          <Ic n="chart" />
          <b className={`ac-net ${tone}`} aria-hidden="true">
            {ready ? <CountUp value={net} ms={700} /> : "Mon mois"}
          </b>
          {gain > 0 && (
            <span className="chip-fly ac-fly" aria-hidden="true">
              +{gain} €
            </span>
          )}
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
export function ToastHost() {
  const toast = useUiStore((s) => s.toast);
  const dismiss = useUiStore((s) => s.dismiss);
  const [bas, setBas] = useState<number | null>(null);
  useEffect(() => {
    if (!toast) return;
    const placer = () => {
      const h = window.innerHeight;
      let haut = h;
      document.querySelectorAll<HTMLElement>(PIEDS).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || r.bottom <= h * 0.45 || r.top >= h) return;
        haut = Math.min(haut, r.top);
      });
      setBas(haut < h ? h - haut + 10 : null);
    };
    const raf = requestAnimationFrame(placer);
    // L'écran peut changer sous le message (un écran suivant, une feuille qui s'ouvre) : on replace.
    const t = setInterval(placer, 200);
    window.addEventListener("scroll", placer, { passive: true });
    window.addEventListener("resize", placer);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(t);
      window.removeEventListener("scroll", placer);
      window.removeEventListener("resize", placer);
    };
  }, [toast]);
  if (!toast) return null;
  return (
    <div className="toast" role="status" aria-live="polite" key={toast.id} style={bas != null ? { bottom: bas } : undefined}>
      <p dangerouslySetInnerHTML={{ __html: toast.html }} />
      {toast.undo && (
        <button
          type="button"
          onClick={() => {
            toast.undo?.();
            dismiss();
          }}
        >
          Annuler
        </button>
      )}
    </div>
  );
}

/** Sur la fiche d’un cheval, l’en-tête porte son nom. */
function TitreCheval() {
  const id = useSearchParams().get("id");
  const nom = useDataStore((s) => s.horses.find((h) => h.id === id)?.name);
  return <>{nom ?? "Fiche du cheval"}</>;
}
