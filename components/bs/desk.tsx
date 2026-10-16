"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Face, Ic, Ill, Money } from "@/components/carnet/ui";
import { Picto } from "@/components/bs/picto";
import { eur, signed } from "@/components/bs/ui";
import { useUiStore } from "@/stores/ui-store";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { toValidate } from "@/lib/domain/seances";
import { billsFor } from "@/lib/domain/billing";
import { suggestions } from "@/lib/domain/leviers";
import { OBSTACLES } from "@/stores/settings-store";
import { currentPeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";
import { INSTALL_HOWTO, useInstall } from "@/lib/pwa";
import { usePaniers } from "@/components/bs/paniers";
import { BILAN, CLIENTS_CHEVAUX, under, usePlusItems } from "@/components/bs/nav";

/* ------------------------------------------------------------------ */
/* L'écran large                                                        */
/* ------------------------------------------------------------------ */

const DESK = "(min-width: 1024px)";
/** Vrai sur un écran d'ordinateur (1024 px et plus). */
export function useDesk() {
  return useSyncExternalStore(
    (f) => {
      const m = window.matchMedia(DESK);
      m.addEventListener("change", f);
      return () => m.removeEventListener("change", f);
    },
    () => window.matchMedia(DESK).matches,
    () => false,
  );
}

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const modKey = () => (isMac() ? "⌘" : "Ctrl");

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Les compteurs de la navigation : à valider, à facturer, actions, tâches. */
export function useNavCounts() {
  const data = useDataStore();
  const capacity = useSettingsStore((s) => s.capacity);
  const parcours = useSettingsStore((s) => s.parcours);
  const objective = useSettingsStore((s) => s.objective);
  return useMemo(() => {
    const period = currentPeriod();
    const done = data.taskLists?.find((l) => l.isDone)?.id;
    return {
      pending: toValidate(data, localToday(), nowHHMM()).length,
      due: billsFor(data, period).reduce((t, b) => t + Math.max(0, b.due), 0),
      acts: suggestions(data, period, capacity).filter((x) => x.status !== "faite" && x.status !== "ecartee").length,
      net: monthBreakdown(data, period).net,
      tasks: (data.tasks ?? []).filter((t) => t.listId !== done).length,
      horses: data.horses.filter((h) => !h.isArchived).length,
      clients: (data.people ?? []).filter((p) => p.active).length,
      parcours: OBSTACLES.filter((o) => parcours[o]).length,
      objective,
    };
  }, [data, capacity, parcours, objective]);
}

/* ------------------------------------------------------------------ */
/* La barre latérale                                                    */
/* ------------------------------------------------------------------ */

/**
 * La barre latérale : la même structure que le téléphone. Accueil,
 * Planning, Clients et chevaux, Mon mois, puis « Ton écurie » : les mêmes
 * lignes que le rond.
 */
export function Sidebar() {
  const path = (usePathname() ?? "").replace(/(.)\/$/, "$1");
  const vue = useSearchParams().get("vue");
  const c = useNavCounts();
  const { count } = usePaniers();
  const plus = usePlusItems();
  const stableName = useSettingsStore((s) => s.stableName);
  const gerant = useSettingsStore((s) => s.gerant);
  const openNoter = useUiStore((s) => s.openNoter);
  const openPalette = useUiStore((s) => s.openPalette);
  const install = useInstall();
  const [how, setHow] = useState(false);
  const main: { href: string; ic: string; label: string; key: string; on: boolean; badge?: string; cls?: string }[] = [
    { href: "/accueil", ic: "home", label: "Accueil", key: "A", on: path === "/accueil" },
    { href: "/planning", ic: "cal", label: "Planning", key: "P", on: under(path, ["/planning", "/valider", "/equipe"]) },
    { href: "/chevaux", ic: "people", label: "Clients et chevaux", key: "C", on: under(path, CLIENTS_CHEVAUX), badge: count ? String(count) : undefined, cls: "attn" },
    { href: "/argent", ic: "chart", label: "Mon mois", key: "M", on: under(path, BILAN) && !vue, badge: signed(c.net), cls: c.net >= 0 ? "in" : "out" },
  ];
  return (
    <aside className="cn-side" aria-label="Navigation">
      <Link href="/accueil" className="wm">
        be stable
      </Link>
      <span className="stb">{stableName}</span>
      <button type="button" className="add" onClick={() => openNoter({ mode: "seance" })}>
        <Ic n="plus" className="cn-ic sm" />
        Ajouter
        <kbd>N</kbd>
      </button>
      <button type="button" className="find" onClick={openPalette}>
        <Ic n="search" className="cn-ic sm" />
        Chercher, aller à…
        <kbd>{modKey()} K</kbd>
      </button>
      <div style={{ display: "grid", gap: 2, marginTop: 8 }}>
        {main.map((it) => (
          <Link key={it.href} href={it.href} className="it" aria-current={it.on ? "page" : undefined} title={`${it.label} (G puis ${it.key})`}>
            <Ic n={it.ic} />
            <span style={{ flex: 1, minWidth: 0 }}>{it.label}</span>
            {it.badge && <em className={it.cls}>{it.badge}</em>}
          </Link>
        ))}
      </div>
      <div className="ac-sgrp">
        <p className="ac-sk">Ton écurie</p>
        {plus.map((it) => {
          const base = it.href?.split(/[?#]/)[0];
          const on = !!base && under(path, [base]);
          return (
            <Link key={it.id} href={it.href ?? "/moi"} className="it" aria-current={on ? "page" : undefined}>
              <Ic n={it.ic} />
              <span style={{ flex: 1, minWidth: 0 }}>{it.label}</span>
              {it.badge && <em className={it.tone ?? ""}>{it.badge}</em>}
            </Link>
          );
        })}
      </div>
      <div className="ft">
        {!install.installed && (
          <button
            type="button"
            className="it"
            style={{ background: "none", border: 0, cursor: "pointer", textAlign: "left" }}
            onClick={async () => {
              if (install.way === "bouton") await install.prompt();
              else setHow(true);
            }}
          >
            <Ic n="install" />
            Installer l’app
          </button>
        )}
        <button type="button" className="it" style={{ background: "none", border: 0, cursor: "pointer", textAlign: "left" }} onClick={() => useUiStore.getState().openHelp()}>
          <Ic n="key" />
          Raccourcis clavier
          <em>?</em>
        </button>
        <p className="stb" style={{ margin: "8px 10px 0" }}>{gerant}</p>
      </div>
      {how && <InstallHowto onClose={() => setHow(false)} />}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Installer l'app                                                      */
/* ------------------------------------------------------------------ */

export function InstallHowto({ onClose }: { onClose: () => void }) {
  const install = useInstall();
  const steps = INSTALL_HOWTO[install.way === "bouton" ? "autre" : install.way];
  useEscape(onClose);
  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet nt-sheet" role="dialog" aria-modal="true" aria-labelledby="bs-install-t">
          <div className="grab" />
          <div className="shd">
            <b id="bs-install-t">Installer Be Stable</b>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          <div className="pad">
            <p className="note" style={{ marginTop: 0 }}>
              Une icône sur ton bureau ou ton écran d’accueil, une fenêtre à part, et l’app s’ouvre même sans réseau.
            </p>
            <ol className="nt-steps">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <div className="tip" style={{ marginTop: 16 }}>
              <Ill n="guide" />
              <span>Tes données restent dans cet appareil : l’app installée sur l’ordinateur et celle du téléphone ne se partagent pas encore leurs saisies.</span>
            </div>
            <button type="button" className="btn full" style={{ marginTop: 16 }} onClick={onClose}>
              J’ai compris
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Le bloc « Installer » des réglages, sur tous les écrans. */
export function InstallCard() {
  const install = useInstall();
  const [how, setHow] = useState(false);
  if (install.installed)
    return (
      <div className="bs-card">
        <span className="bs-pic soft">
          <Picto name="check" />
        </span>
        <div style={{ flex: 1 }}>
          <div className="k">Installée</div>
          <b>Be Stable s’ouvre comme une app sur cet appareil.</b>
        </div>
      </div>
    );
  return (
    <>
      <button type="button" className="bs-card" style={{ width: "100%", textAlign: "left" }} onClick={async () => (install.way === "bouton" ? install.prompt() : setHow(true))}>
        <span className="bs-pic soft">
          <Picto name="install" />
        </span>
        <div style={{ flex: 1 }}>
          <div className="k">Ordinateur ou téléphone</div>
          <b>Installer Be Stable comme une app</b>
        </div>
        <Picto name="arrowR" />
      </button>
      {how && <InstallHowto onClose={() => setHow(false)} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* La palette : chercher, aller, faire                                  */
/* ------------------------------------------------------------------ */

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, " ");

type Cmd = { id: string; group: string; label: string; sub?: string; ic?: string; money?: number; face?: string; hint?: string; run: () => void };

function useEscape(f: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && f();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [f]);
}

export function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen);
  if (!open) return null;
  return <PaletteInner />;
}

function PaletteInner() {
  const close = useUiStore((s) => s.closePalette);
  const openNoter = useUiStore((s) => s.openNoter);
  const router = useRouter();
  const data = useDataStore();
  const c = useNavCounts();
  const plus = usePlusItems();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  useEscape(close);

  const go = (href: string) => () => {
    close();
    router.push(href);
  };
  const add = (mode: "seance" | "soin" | "tache" | "depense") => () => {
    close();
    openNoter({ mode });
  };

  const all: Cmd[] = useMemo(
    () => [
      { id: "a-seance", group: "Faire", label: "Planifier une séance", sub: "cours, travail, balade", ic: "cal", hint: "N", run: add("seance") },
      { id: "a-soin", group: "Faire", label: "Noter un soin", sub: "maréchal, véto, vermifuge…", ic: "shoe", run: add("soin") },
      { id: "a-tache", group: "Faire", label: "Ajouter une tâche d’équipe", ic: "board", run: add("tache") },
      { id: "a-depense", group: "Faire", label: "Noter une dépense", sub: "ou une recette", ic: "euro", run: add("depense") },
      ...(c.pending ? [{ id: "a-valider", group: "Faire", label: `Confirmer ce qui attend (${c.pending})`, ic: "ck", run: go("/valider") }] : []),
      { id: "a-facturer", group: "Faire", label: "Préparer les factures du mois", sub: c.due ? `${eur(c.due)} en attente` : undefined, ic: "doc", run: go("/argent?vue=facturer") },
      { id: "g-accueil", group: "Aller à", label: "Accueil", ic: "home", hint: "G A", run: go("/accueil") },
      { id: "g-planning", group: "Aller à", label: "Planning", ic: "cal", hint: "G P", run: go("/planning") },
      { id: "g-chevaux", group: "Aller à", label: "Clients et chevaux", ic: "people", hint: "G C", run: go("/chevaux") },
      { id: "g-mois", group: "Aller à", label: "Mon mois", sub: signed(c.net), money: c.net, ic: "chart", hint: "G M", run: go("/argent") },
      ...plus.map((it) => ({ id: `r-${it.id}`, group: "Aller à", label: it.label, sub: it.sub, ic: it.ic, hint: HINTS[it.id], run: go(it.href ?? "/moi") })),
      { id: "g-recherche", group: "Aller à", label: "Chercher", sub: "un cheval, un client", ic: "search", run: go("/recherche") },
      { id: "g-valider", group: "Aller à", label: "Séances à confirmer", sub: "dans Planning", ic: "ck", hint: "G V", run: go("/valider") },
      { id: "g-equipe", group: "Aller à", label: "Tâches de l’équipe", sub: "dans Planning", ic: "board", hint: "G E", run: go("/equipe") },
      { id: "g-clients", group: "Aller à", label: "Mes clients", sub: "dans Clients et chevaux", ic: "people", hint: "G K", run: go("/clients") },
      { id: "g-leviers", group: "Aller à", label: "Pistes pour gagner plus", sub: "dans Mon mois", ic: "bulb", hint: "G L", run: go("/argent?vue=leviers") },
      { id: "g-mouv", group: "Aller à", label: "Entrées et sorties d’argent", sub: "dans Mon mois", ic: "list", run: go("/argent?vue=mouvements") },
      { id: "g-bilans", group: "Aller à", label: "Sur plusieurs mois", sub: "bilan sur 3, 6 ou 12 mois", ic: "chart", hint: "G B", run: go("/pilotage") },
      { id: "g-seuil", group: "Aller à", label: "Combien de chevaux pour ne pas perdre d’argent", ic: "flag", run: go("/seuil") },
      ...data.horses
        .filter((h) => !h.isArchived)
        .map((h) => ({ id: `h-${h.id}`, group: "Chevaux", label: h.name, sub: [h.pensionType, h.ownerName].filter(Boolean).join(" · "), face: h.id, run: go(`/ticket?id=${h.id}`) })),
      ...(data.people ?? [])
        .filter((p) => p.active)
        .map((p) => ({ id: `p-${p.id}`, group: "Clients", label: p.name, sub: p.role === "proprietaire" ? "propriétaire" : "cavalier", ic: "user", run: go(`/clients?q=${encodeURIComponent(p.name)}`) })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, c, plus],
  );

  const shown = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return all.filter((x) => x.group === "Faire" || x.group === "Aller à");
    const words = n.split(/\s+/);
    return all.filter((x) => words.every((w) => norm(`${x.label} ${x.sub ?? ""} ${x.group}`).includes(w))).slice(0, 40);
  }, [q, all]);
  const sel = Math.min(i, Math.max(0, shown.length - 1));

  useEffect(() => {
    list.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  let last = "";
  return createPortal(
    <div className="carnet carnet-portal">
      <div className="nt-pal-scrim" onClick={close} />
      <div className="nt-pal" role="dialog" aria-modal="true" aria-label="Chercher ou faire">
        <label className="nt-pin">
          <Ic n="search" />
          <input
            autoFocus
            value={q}
            placeholder="Un cheval, un client, une action…"
            onChange={(e) => {
              setQ(e.target.value);
              setI(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setI(Math.min(sel + 1, shown.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setI(Math.max(sel - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                shown[sel]?.run();
              }
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="bs-palette-list"
            aria-activedescendant={shown[sel] ? `cmd-${shown[sel].id}` : undefined}
          />
          <kbd>Échap</kbd>
          <button type="button" className="x" onClick={close} aria-label="Fermer">
            <Ic n="x" className="" />
          </button>
        </label>
        <div className="nt-pls" id="bs-palette-list" role="listbox" ref={list}>
          {shown.length === 0 && <p className="none">Rien ne correspond à « {q} ».</p>}
          {shown.map((x, k) => {
            const head = x.group !== last ? x.group : null;
            last = x.group;
            const horse = x.face ? data.horses.find((h) => h.id === x.face) : undefined;
            return (
              <div key={x.id}>
                {head && <p className="g">{head}</p>}
                <button
                  type="button"
                  id={`cmd-${x.id}`}
                  data-i={k}
                  role="option"
                  aria-selected={k === sel}
                  className="it"
                  onMouseMove={() => k !== sel && setI(k)}
                  onClick={x.run}
                >
                  {horse ? <Face horse={horse} /> : <Ic n={x.ic ?? "arrow"} />}
                  <span className="l">
                    {x.label}
                    {x.money !== undefined ? (
                      <small>
                        <Money v={x.money} />
                      </small>
                    ) : (
                      x.sub && <small>{x.sub}</small>
                    )}
                  </span>
                  {x.hint && <kbd>{x.hint}</kbd>}
                </button>
              </div>
            );
          })}
        </div>
        <p className="nt-pft">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> choisir
          </span>
          <span>
            <kbd>Entrée</kbd> ouvrir
          </span>
          <span>
            <kbd>?</kbd> tous les raccourcis
          </span>
        </p>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Les raccourcis clavier                                               */
/* ------------------------------------------------------------------ */

const GOTO: Record<string, string> = {
  a: "/accueil",
  p: "/planning",
  v: "/valider",
  c: "/chevaux",
  e: "/equipe",
  m: "/argent",
  l: "/argent?vue=leviers",
  f: "/argent?vue=facturer",
  k: "/clients",
  r: "/moi",
  b: "/pilotage",
  s: "/prestations",
  o: "/ma-fiche",
};

/** Les raccourcis des lignes du rond, dans la palette. */
const HINTS: Record<string, string> = { fiche: "G O", tarifs: "G S", reglages: "G R" };

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

export function Shortcuts() {
  const router = useRouter();
  const pending = useRef(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUiStore.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (ui.paletteOpen) ui.closePalette();
        else ui.openPalette();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (ui.paletteOpen || ui.noterOpen || ui.seanceId || ui.helpOpen) return;
      const k = e.key.toLowerCase();
      if (pending.current && Date.now() - pending.current < 1200) {
        pending.current = 0;
        if (GOTO[k]) {
          e.preventDefault();
          router.push(GOTO[k]);
        }
        return;
      }
      if (k === "g") pending.current = Date.now();
      else if (k === "n") {
        e.preventDefault();
        const id = location.pathname.includes("/ticket") ? new URLSearchParams(location.search).get("id") : null;
        ui.openNoter(id ? { horseIds: [id] } : { mode: "seance" });
      } else if (k === "/") {
        e.preventDefault();
        ui.openPalette();
      } else if (e.key === "?") {
        e.preventDefault();
        ui.openHelp();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // Raccourci d'icône de l'app (manifeste) : « ?ajouter=seance » ouvre l'ajout.
  const params = useSearchParams();
  useEffect(() => {
    const m = params.get("ajouter");
    if (m === "seance" || m === "soin" || m === "tache" || m === "depense") useUiStore.getState().openNoter({ mode: m });
  }, [params]);
  return null;
}

export function ShortcutHelp() {
  const open = useUiStore((s) => s.helpOpen);
  const close = useUiStore((s) => s.closeHelp);
  if (!open) return null;
  return <HelpInner close={close} />;
}

function HelpInner({ close }: { close: () => void }) {
  useEscape(close);
  const rows: [string, string[]][] = [
    ["Chercher, aller à, faire", [modKey(), "K"]],
    ["Noter (séance, soin, tâche, dépense)", ["N"]],
    ["Accueil", ["G", "A"]],
    ["Planning", ["G", "P"]],
    ["Clients et chevaux", ["G", "C"]],
    ["Mon mois", ["G", "M"]],
    ["Séances à confirmer", ["G", "V"]],
    ["Tâches de l’équipe", ["G", "E"]],
    ["Mes clients", ["G", "K"]],
    ["Pistes pour gagner plus", ["G", "L"]],
    ["À facturer", ["G", "F"]],
    ["Sur plusieurs mois", ["G", "B"]],
    ["Ma fiche mon-ecurie.fr", ["G", "O"]],
    ["Mes tarifs", ["G", "S"]],
    ["Réglages", ["G", "R"]],
    ["Planning : semaine précédente, suivante", ["←", "→"]],
    ["Planning : revenir à aujourd’hui", ["T"]],
    ["Fermer une fenêtre", ["Échap"]],
  ];
  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={close} />
        <div className="sheet nt-sheet" role="dialog" aria-modal="true" aria-labelledby="bs-help-t">
          <div className="grab" />
          <div className="shd">
            <b id="bs-help-t">Raccourcis clavier</b>
            <button type="button" className="x" onClick={close} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          <p className="nt-lead">Pour aller vite sur ordinateur. « G puis A » : tape G, puis A.</p>
          <dl className="nt-keyl">
            {rows.map(([l, ks]) => (
              <div key={l}>
                <dt>{l}</dt>
                <dd>
                  {ks.map((k, i) => (
                    <kbd key={i}>{k}</kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>,
    document.body,
  );
}
