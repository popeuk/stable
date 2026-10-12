"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Picto } from "@/components/bs/picto";
import { signed } from "@/components/bs/ui";
import { useUiStore } from "@/stores/ui-store";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { toValidate } from "@/lib/domain/seances";
import { billsFor } from "@/lib/domain/billing";
import { suggestions } from "@/lib/domain/leviers";
import { currentPeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";
import { AideBouton, isRoot, useRetour, useSuiviNavigation } from "@/components/bs/nav";

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * L'en-tête : à gauche be stable (ou le retour, hors des onglets), le nom de
 * l'écurie, l'aide de l'écran, et à droite le Bilan avec ce qu'il reste ce
 * mois. Le menu, lui, est dans la barre d'onglets.
 */
export function Header() {
  const data = useDataStore();
  const stableName = useSettingsStore((s) => s.stableName);
  const net = useMemo(() => monthBreakdown(data, currentPeriod()).net, [data]);
  const path = usePathname() ?? "";
  const retour = useRetour();
  useSuiviNavigation();
  const surBilan = ["/argent", "/pilotage", "/seuil", "/scenarios", "/depenses"].some((m) => path.startsWith(m));
  return (
    <header className="bs-hd">
      {isRoot(path) ? (
        <Link href="/accueil" className="bs-wm">
          be stable
        </Link>
      ) : (
        <button type="button" className="bs-icon" onClick={retour} aria-label="Revenir en arrière">
          <Picto name="chevL" />
        </button>
      )}
      <span className="stb">{isRoot(path) ? `· ${stableName}` : stableName}</span>
      <AideBouton />
      <Link href="/argent" className={`bs-bilan${net < 0 ? " neg" : ""}`} aria-current={surBilan ? "page" : undefined} aria-label={`Bilan du mois : il te reste ${signed(net)}`}>
        <span className="l">Bilan</span>
        <span className="v">{signed(net)}</span>
      </Link>
    </header>
  );
}

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

  const it = (href: string, picto: string, label: string, em?: string, red?: boolean) => (
    <Link href={href} className="it" onClick={onClose}>
      <Picto name={picto} />
      {label}
      {em && <em className={red ? "r" : ""}>{em}</em>}
    </Link>
  );
  return (
    <>
      <div className="bs-drawer-scrim" onClick={onClose} />
      <nav className="bs-drawer" aria-label="Menu">
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
          <span className="bs-wm" style={{ fontSize: 21 }}>
            be stable
          </span>
          <span style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.25, flex: 1 }}>
            {s.stableName}
            <br />
            {s.gerant}
          </span>
          <button type="button" className="bs-burger" onClick={onClose} aria-label="Fermer le menu">
            <Picto name="x" />
          </button>
        </div>
        <Link href="/recherche" className="bs-field" style={{ marginTop: 12, color: "var(--ink-3)" }} onClick={onClose}>
          <Picto name="search" size={16} />
          <span style={{ flex: 1 }}>Chercher un cheval, un client…</span>
        </Link>
        <p className="grp">Au quotidien</p>
        {it("/valider", "check", "Séances à confirmer", pending ? String(pending) : undefined, pending > 0)}
        {it("/equipe", "board", "Tâches de l’équipe", openTasks ? String(openTasks) : undefined)}
        {it("/clients", "personne", "Mes clients")}
        <p className="grp">Ton bilan</p>
        {it("/argent", "euro", "Bilan du mois", signed(net))}
        {it("/argent?vue=leviers", "bulb", "Pistes pour gagner plus", acts ? String(acts) : undefined)}
        {it("/argent?vue=facturer", "doc", "À facturer", due ? `${Math.round(due)} €` : undefined)}
        {it("/argent?vue=mouvements", "list", "Entrées et sorties d’argent")}
        {it("/pilotage", "chart", "Bilan sur plusieurs mois")}
        <p className="grp">Ton écurie</p>
        {it("/ma-fiche", "flag", "Ma fiche sur mon-ecurie.fr")}
        {it("/prestations", "cours", "Mes cours, services et prix")}
        {it("/moi", "reglages", "Mon écurie et mes réglages")}
        {it("/parcours", "flag", "Mes premiers pas", s.parcoursPlusTard && !(s.parcours.chevaux && s.parcours.tarifs && s.parcours.factures) ? "à finir" : undefined, true)}
        <p className="grp">Besoin d’aide ?</p>
        <button type="button" className="it" onClick={() => (s.revoirAides(), onClose())}>
          <Picto name="aide" />
          Revoir les explications de chaque écran
        </button>
        {it("/moi#bestable", "book", "Le guide, la communauté, l’annuaire")}
      </nav>
    </>
  );
}

/** La barre d'onglets : Accueil, Planning, +, Chevaux, Menu. Le Bilan est en haut à droite. */
const TABS = [
  { href: "/accueil", label: "Accueil", picto: "home", match: ["/accueil"] },
  { href: "/planning", label: "Planning", picto: "cal", match: ["/planning", "/valider"] },
  { href: "/chevaux", label: "Chevaux", picto: "horse", match: ["/chevaux", "/ticket", "/part", "/cheval"] },
];

export function TabBar() {
  const path = usePathname() ?? "";
  const openNoter = useUiStore((s) => s.openNoter);
  const [menu, setMenu] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMenu(false), [path]);
  const ailleurs = !TABS.some((t) => t.match.some((m) => path === m || path.startsWith(m + "/"))) && !["/argent", "/pilotage", "/seuil", "/scenarios", "/depenses"].some((m) => path.startsWith(m));
  const tab = (t: (typeof TABS)[number]) => {
    const on = t.match.some((m) => path === m || path.startsWith(m + "/"));
    return (
      <Link key={t.href} href={t.href} className="bs-tab" aria-current={on ? "page" : undefined}>
        <Picto name={t.picto} />
        {t.label}
      </Link>
    );
  };
  return (
    <nav className="bs-tabs" aria-label="Navigation principale">
      <div className="bs-tabs-in">
        {tab(TABS[0])}
        {tab(TABS[1])}
        <button
          type="button"
          className="bs-add"
          aria-label="Ajouter une séance, un soin, une tâche ou une dépense"
          onClick={() => {
            const id = path.startsWith("/ticket") ? new URLSearchParams(window.location.search).get("id") : null;
            openNoter(id ? { horseIds: [id] } : {});
          }}
        >
          <Picto name="plus" />
        </button>
        {tab(TABS[2])}
        <button type="button" className="bs-tab" aria-current={ailleurs ? "page" : undefined} aria-expanded={menu} onClick={() => setMenu(true)}>
          <Picto name="menu" />
          Menu
        </button>
      </div>
      {/* Le menu sort de la barre : sur iPhone, son flou enfermerait le menu dedans. */}
      {menu && createPortal(<Drawer onClose={() => setMenu(false)} />, document.body)}
    </nav>
  );
}

export function ToastHost() {
  const toast = useUiStore((s) => s.toast);
  const dismiss = useUiStore((s) => s.dismiss);
  if (!toast) return null;
  return (
    <div className="bs-toast" role="status" aria-live="polite" key={toast.id}>
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
