"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { signed } from "@/components/bs/ui";
import { CountUp, Ic, eur } from "@/components/carnet/ui";
import { useUiStore } from "@/stores/ui-store";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { toValidate } from "@/lib/domain/seances";
import { billsFor } from "@/lib/domain/billing";
import { suggestions } from "@/lib/domain/leviers";
import { currentPeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";
import { AideBouton, isRoot, titreDe, useRetour, useSuiviNavigation } from "@/components/bs/nav";

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * L'en-tête du carnet : be stable et l'écurie sur les onglets, sinon le
 * retour et le titre de l'écran ; l'aide ; et le Bilan du mois, qui compte
 * et saute quand de l'argent rentre.
 */
export function Header() {
  const data = useDataStore();
  const stableName = useSettingsStore((s) => s.stableName);
  const net = useMemo(() => monthBreakdown(data, currentPeriod()).net, [data]);
  const path = usePathname() ?? "";
  const retour = useRetour();
  useSuiviNavigation();
  const surBilan = BILAN.some((m) => path.startsWith(m));
  const avant = useRef(net);
  const [gain, setGain] = useState(0);
  useEffect(() => {
    const d = Math.round(net - avant.current);
    avant.current = net;
    if (d <= 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGain(d);
    const t = setTimeout(() => setGain(0), 1400);
    return () => clearTimeout(t);
  }, [net]);
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
      <AideBouton className="help" />
      <Link href="/argent" className={`bilan${surBilan ? " on" : ""}${gain ? " bump" : ""}`} aria-current={surBilan ? "page" : undefined} aria-label={`Bilan du mois : il te reste ${signed(net)}`}>
        <small>Bilan</small>
        <b style={net < 0 && !surBilan ? { color: "var(--out)" } : undefined}>
          <CountUp value={net} ms={600} />
        </b>
        {gain > 0 && (
          <span className="chip-fly" style={{ right: 0, top: "100%", marginTop: 6 }} aria-hidden="true">
            +{gain} €
          </span>
        )}
      </Link>
    </header>
  );
}

const BILAN = ["/argent", "/pilotage", "/seuil", "/scenarios", "/depenses", "/plan", "/audit", "/decouvertes", "/conseiller"];

export function Drawer({ onClose }: { onClose: () => void }) {
  const data = useDataStore();
  const s = useSettingsStore();
  const period = useMemo(() => currentPeriod(), []);
  const pending = useMemo(() => toValidate(data, localToday(), nowHHMM()).length, [data]);
  const due = useMemo(() => billsFor(data, period).reduce((t, b) => t + b.due, 0), [data, period]);
  const acts = useMemo(() => suggestions(data, period, s.capacity).filter((x) => x.status !== "faite").length, [data, period, s.capacity]);
  const net = useMemo(() => monthBreakdown(data, period).net, [data, period]);
  const openTasks = (data.tasks ?? []).filter((t) => t.listId !== data.taskLists?.find((l) => l.isDone)?.id).length;

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    // La page ne défile pas derrière le menu ouvert.
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = avant;
    };
  }, [onClose]);

  const it = (href: string, ic: string, label: string, em?: ReactNode, cls?: string) => (
    <Link href={href} className="it" onClick={onClose}>
      <Ic n={ic} />
      {label}
      {em !== undefined && <em className={cls}>{em}</em>}
    </Link>
  );
  return (
    <div className="carnet carnet-portal">
      <div className="drawer-scrim" onClick={onClose} />
      <nav className="drawer" aria-label="Menu">
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
          <span className="wm" style={{ fontWeight: 800, fontSize: 21, letterSpacing: "-.035em" }}>
            be stable
          </span>
          <span style={{ fontSize: 12, color: "var(--ink3)", lineHeight: 1.25, flex: 1 }}>
            {s.stableName}
            <br />
            {s.gerant}
          </span>
          <button type="button" className="x" onClick={onClose} aria-label="Fermer le menu">
            <svg viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <Link href="/recherche" className="input" style={{ marginTop: 14, color: "var(--ink3)", textDecoration: "none" }} onClick={onClose}>
          <Ic n="search" className="cn-ic sm" />
          Chercher un cheval, un client…
        </Link>
        <p className="grp">Au quotidien</p>
        {it("/valider", "ck", "Séances à confirmer", pending ? pending : undefined, "attn")}
        {it("/equipe", "board", "Tâches de l’équipe", openTasks ? openTasks : undefined)}
        {it("/clients", "people", "Mes clients")}
        <p className="grp">Ton bilan</p>
        {it("/argent", "euro", "Bilan du mois", signed(net), net >= 0 ? "in" : "out")}
        {it("/argent?vue=leviers", "bulb", "Pistes pour gagner plus", acts ? acts : undefined)}
        {it("/argent?vue=facturer", "doc", "À facturer", due ? eur(due) : undefined)}
        {it("/argent?vue=mouvements", "list", "Entrées et sorties d’argent")}
        {it("/pilotage", "chart", "Bilan sur plusieurs mois")}
        <p className="grp">Ton écurie</p>
        {it("/ma-fiche", "flag", "Ma fiche sur mon-ecurie.fr")}
        {it("/prestations", "hay", "Mes cours, services et prix")}
        {it("/moi", "gear", "Mon écurie et mes réglages")}
        {it("/parcours", "flag", "Mes premiers pas", s.parcoursPlusTard && !(s.parcours.chevaux && s.parcours.tarifs && s.parcours.factures) ? "à finir" : undefined, "attn")}
        <p className="grp">Besoin d’aide ?</p>
        <button type="button" className="it" style={{ width: "100%", background: "none", border: 0, borderBottom: "1px solid var(--line2)", textAlign: "left", cursor: "pointer" }} onClick={() => (s.revoirAides(), onClose())}>
          <Ic n="help" />
          Revoir les explications de chaque écran
        </button>
        {it("/moi#bestable", "doc", "Le guide, la communauté, l’annuaire")}
      </nav>
    </div>
  );
}

/** La barre d'onglets : Accueil, Planning, +, Chevaux, Menu. Le Bilan est en haut à droite. */
const TABS = [
  { href: "/accueil", label: "Accueil", ic: "home", match: ["/accueil"] },
  { href: "/planning", label: "Planning", ic: "cal", match: ["/planning", "/valider"] },
  { href: "/chevaux", label: "Chevaux", ic: "horse", match: ["/chevaux", "/ticket", "/part", "/cheval"] },
];

export function TabBar() {
  const path = usePathname() ?? "";
  const openNoter = useUiStore((s) => s.openNoter);
  const [menu, setMenu] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMenu(false), [path]);
  const ailleurs = !TABS.some((t) => t.match.some((m) => path === m || path.startsWith(m + "/"))) && !BILAN.some((m) => path.startsWith(m));
  const tab = (t: (typeof TABS)[number]) => {
    const on = t.match.some((m) => path === m || path.startsWith(m + "/"));
    return (
      <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}>
        <Ic n={t.ic} />
        {t.label}
      </Link>
    );
  };
  return (
    <nav className="tb" aria-label="Navigation principale">
      <div>
        {tab(TABS[0])}
        {tab(TABS[1])}
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
        {tab(TABS[2])}
        <button type="button" aria-current={ailleurs ? "page" : undefined} aria-expanded={menu} onClick={() => setMenu(true)}>
          <Ic n="menu" />
          Menu
        </button>
      </div>
      {/* Le menu sort de la barre : sur iPhone, une barre floutée enfermerait le menu dedans. */}
      {menu && createPortal(<Drawer onClose={() => setMenu(false)} />, document.body)}
    </nav>
  );
}

export function ToastHost() {
  const toast = useUiStore((s) => s.toast);
  const dismiss = useUiStore((s) => s.dismiss);
  if (!toast) return null;
  return (
    <div className="toast" role="status" aria-live="polite" key={toast.id}>
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
