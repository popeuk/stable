"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * L'en-tête : be stable, l'écurie, le compteur du mois (ce qui est validé
 * depuis le 1er) et le menu. Il reste en haut de chaque écran.
 */
export function Header() {
  const [open, setOpen] = useState(false);
  const data = useDataStore();
  const stableName = useSettingsStore((s) => s.stableName);
  const net = useMemo(() => monthBreakdown(data, currentPeriod()).net, [data]);
  const path = usePathname();
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [path]);
  return (
    <>
      <header className="bs-hd">
        <Link href="/accueil" className="bs-wm">
          be stable
        </Link>
        <span className="stb">· {stableName}</span>
        <Link href="/argent" className={`bs-count${net < 0 ? " neg" : ""}`} aria-label={`Résultat du mois : ${signed(net)}`}>
          {net >= 0 && <Picto name="up" />}
          {signed(net)}
        </Link>
        <button type="button" className="bs-burger" aria-label="Ouvrir le menu" aria-expanded={open} onClick={() => setOpen(true)}>
          <Picto name="menu" />
        </button>
      </header>
      {open && <Drawer onClose={() => setOpen(false)} />}
    </>
  );
}

function Drawer({ onClose }: { onClose: () => void }) {
  const data = useDataStore();
  const s = useSettingsStore();
  const period = useMemo(() => currentPeriod(), []);
  const pending = useMemo(() => toValidate(data, localToday(), nowHHMM()).length, [data]);
  const due = useMemo(() => billsFor(data, period).reduce((t, b) => t + b.due, 0), [data, period]);
  const acts = useMemo(() => suggestions(data, period, s.capacity).filter((x) => x.status !== "faite").length, [data, period, s.capacity]);
  const net = useMemo(() => monthBreakdown(data, period).net, [data, period]);
  const openTasks = (data.tasks ?? []).filter((t) => t.listId !== data.taskLists?.find((l) => l.isDone)?.id).length;
  const horses = data.horses.filter((h) => !h.isArchived).length;

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
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
        <p className="grp">Le quotidien</p>
        {it("/accueil", "home", "Accueil")}
        {it("/planning", "cal", "Planning", pending ? `${pending} à valider` : undefined, pending > 0)}
        {it("/chevaux", "horse", "Chevaux", String(horses))}
        {it("/equipe", "board", "Tâches d’équipe", String(openTasks))}
        <p className="grp">L’argent</p>
        {it("/argent", "euro", "Le mois", signed(net))}
        {it("/argent?vue=leviers", "bulb", "Leviers et actions", acts ? String(acts) : undefined)}
        {it("/argent?vue=facturer", "doc", "À facturer", due ? `${Math.round(due)} €` : undefined)}
        {it("/argent?vue=mouvements", "list", "Mouvements")}
        {it("/pilotage", "chart", "Bilans")}
        <p className="grp">L’écurie</p>
        {it("/prestations", "cours", "Prestations et tarifs")}
        {it("/clients", "personne", "Clients et propriétaires")}
        {it("/moi", "reglages", "Mon écurie et réglages")}
        {it("/parcours", "flag", "Parcours de démarrage")}
        <p className="grp">Be Stable</p>
        {it("/moi#bestable", "book", "Guide, communauté, annuaire")}
      </nav>
    </>
  );
}

/** La barre d'onglets : Accueil, Planning, +, Chevaux, Argent. */
const TABS = [
  { href: "/accueil", label: "Accueil", picto: "home", match: ["/accueil", "/equipe", "/moi", "/clients", "/prestations", "/recherche"] },
  { href: "/planning", label: "Planning", picto: "cal", match: ["/planning", "/valider"] },
  { href: "/chevaux", label: "Chevaux", picto: "horse", match: ["/chevaux", "/ticket", "/part", "/cheval"] },
  { href: "/argent", label: "Argent", picto: "euro", match: ["/argent", "/mois", "/seuil", "/pilotage", "/depenses", "/scenarios"] },
];

export function TabBar() {
  const path = usePathname() ?? "";
  const openNoter = useUiStore((s) => s.openNoter);
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
        {tab(TABS[3])}
      </div>
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
