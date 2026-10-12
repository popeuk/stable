"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Picto } from "@/components/bs/picto";
import { HorseFace } from "@/components/bs/horse-face";
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

type NavItem = { href: string; picto: string; label: string; badge?: string; hot?: boolean; key?: string; match: (p: string, vue: string | null) => boolean };

function useNav(): { title: string; items: NavItem[] }[] {
  const c = useNavCounts();
  return [
    {
      title: "Le quotidien",
      items: [
        { href: "/accueil", picto: "home", label: "Accueil", key: "A", match: (p) => p === "/accueil" },
        { href: "/planning", picto: "cal", label: "Planning", key: "P", match: (p) => p.startsWith("/planning") },
        { href: "/valider", picto: "check", label: "À confirmer", badge: c.pending ? String(c.pending) : undefined, hot: c.pending > 0, key: "V", match: (p) => p.startsWith("/valider") },
        { href: "/chevaux", picto: "horse", label: "Chevaux", badge: String(c.horses), key: "C", match: (p) => ["/chevaux", "/ticket", "/part", "/cheval"].some((m) => p.startsWith(m)) },
        { href: "/equipe", picto: "board", label: "Tâches de l’équipe", badge: c.tasks ? String(c.tasks) : undefined, key: "E", match: (p) => p.startsWith("/equipe") },
      ],
    },
    {
      title: "Ton bilan",
      items: [
        { href: "/argent", picto: "euro", label: "Bilan du mois", badge: signed(c.net), key: "M", match: (p, v) => p.startsWith("/argent") && !v },
        { href: "/argent?vue=leviers", picto: "bulb", label: "Pistes pour gagner plus", badge: c.acts ? String(c.acts) : undefined, key: "L", match: (p, v) => p.startsWith("/argent") && v === "leviers" },
        { href: "/argent?vue=facturer", picto: "doc", label: "À facturer", badge: c.due ? eur(c.due) : undefined, key: "F", match: (p, v) => p.startsWith("/argent") && v === "facturer" },
        { href: "/argent?vue=mouvements", picto: "list", label: "Entrées et sorties", match: (p, v) => p.startsWith("/argent") && v === "mouvements" },
        { href: "/pilotage", picto: "chart", label: "Sur plusieurs mois", key: "B", match: (p) => ["/pilotage", "/seuil", "/scenarios"].some((m) => p.startsWith(m)) },
      ],
    },
    {
      title: "Ton écurie",
      items: [
        { href: "/ma-fiche", picto: "flag", label: "Ma fiche mon-ecurie.fr", match: (p) => p.startsWith("/ma-fiche") },
        { href: "/prestations", picto: "cours", label: "Cours et services", match: (p) => p.startsWith("/prestations") },
        { href: "/clients", picto: "personne", label: "Mes clients", badge: c.clients ? String(c.clients) : undefined, key: "K", match: (p) => p.startsWith("/clients") },
        { href: "/moi", picto: "reglages", label: "Mon écurie", match: (p) => p.startsWith("/moi") },
        ...(c.parcours < 6 ? [{ href: "/parcours", picto: "flag", label: "Premiers pas", badge: `${c.parcours}/6`, match: (p: string) => p.startsWith("/parcours") }] : []),
      ],
    },
  ];
}

export function Sidebar() {
  const path = (usePathname() ?? "").replace(/(.)\/$/, "$1");
  const vue = useSearchParams().get("vue");
  const nav = useNav();
  const c = useNavCounts();
  const stableName = useSettingsStore((s) => s.stableName);
  const gerant = useSettingsStore((s) => s.gerant);
  const openNoter = useUiStore((s) => s.openNoter);
  const openPalette = useUiStore((s) => s.openPalette);
  const install = useInstall();
  const [how, setHow] = useState(false);
  const pct = Math.max(0, Math.min(100, c.objective ? (c.net / c.objective) * 100 : 0));
  const month = new Date().toLocaleDateString("fr-FR", { month: "long" });

  return (
    <aside className="bs-side" aria-label="Navigation">
      <div className="bs-side-hd">
        <Link href="/accueil" className="bs-wm">
          be stable
        </Link>
        <span>{stableName}</span>
      </div>

      <button type="button" className="bs-side-add" onClick={() => openNoter({ mode: "seance" })}>
        <Picto name="plus" />
        Ajouter
        <kbd>N</kbd>
      </button>
      <button type="button" className="bs-side-search" onClick={openPalette}>
        <Picto name="search" />
        Chercher, aller à…
        <kbd>{modKey()} K</kbd>
      </button>

      <nav className="bs-side-nav">
        {nav.map((g) => (
          <div key={g.title}>
            <p className="grp">{g.title}</p>
            {g.items.map((it) => {
              const on = it.match(path, vue);
              return (
                <Link key={it.href} href={it.href} className="it" aria-current={on ? "page" : undefined} title={it.key ? `${it.label} (G puis ${it.key})` : it.label}>
                  <Picto name={it.picto} />
                  <span className="l">{it.label}</span>
                  {it.badge && <em className={it.hot ? "hot" : ""}>{it.badge}</em>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="bs-side-ft">
        <Link href="/argent" className="bs-side-goal">
          <span className="k">
            Objectif de {month} · {eur(c.objective)}
          </span>
          <span className="v">{signed(c.net)}</span>
          <span className="bar" aria-hidden>
            <i style={{ transform: `scaleX(${pct / 100})` }} />
          </span>
        </Link>
        {!install.installed && (
          <button
            type="button"
            className="bs-side-link"
            onClick={async () => {
              if (install.way === "bouton") await install.prompt();
              else setHow(true);
            }}
          >
            <Picto name="install" />
            Installer l’app
          </button>
        )}
        <button type="button" className="bs-side-link" onClick={() => useUiStore.getState().openHelp()}>
          <Picto name="keys" />
          Raccourcis clavier
          <kbd>?</kbd>
        </button>
        <p className="who">{gerant}</p>
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
    <>
      <div className="bs-scrim" onClick={onClose} />
      <div className="bs-dialog" role="dialog" aria-modal="true" aria-labelledby="bs-install-t">
        <button type="button" className="bs-x" onClick={onClose} aria-label="Fermer">
          <Picto name="x" size={20} />
        </button>
        <h2 id="bs-install-t" className="bs-d bs-t2">
          Installer Be Stable
        </h2>
        <p className="bs-p">Une icône sur ton bureau ou ton écran d’accueil, une fenêtre à part, et l’app s’ouvre même sans réseau.</p>
        <ol className="bs-steps">
          {steps.map((s, i) => (
            <li key={i}>
              <span>{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <p className="bs-p" style={{ fontSize: 12.5 }}>
          Tes données restent dans cet appareil : l’app installée sur l’ordinateur et celle du téléphone ne se partagent pas encore leurs saisies.
        </p>
      </div>
    </>,
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

type Cmd = { id: string; group: string; label: string; sub?: string; picto?: string; face?: string; hint?: string; run: () => void };

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
      { id: "a-seance", group: "Faire", label: "Planifier une séance", sub: "cours, travail, balade", picto: "cours", hint: "N", run: add("seance") },
      { id: "a-soin", group: "Faire", label: "Noter un soin", sub: "maréchal, véto, vermifuge…", picto: "fer", run: add("soin") },
      { id: "a-tache", group: "Faire", label: "Ajouter une tâche d’équipe", picto: "board", run: add("tache") },
      { id: "a-depense", group: "Faire", label: "Noter une dépense ou une recette", picto: "euro", run: add("depense") },
      ...(c.pending ? [{ id: "a-valider", group: "Faire", label: `Valider ce qui attend (${c.pending})`, picto: "check", run: go("/valider") }] : []),
      { id: "a-facturer", group: "Faire", label: "Préparer les factures du mois", sub: c.due ? `${eur(c.due)} en attente` : undefined, picto: "doc", run: go("/argent?vue=facturer") },
      { id: "g-accueil", group: "Aller à", label: "Accueil", picto: "home", hint: "G A", run: go("/accueil") },
      { id: "g-planning", group: "Aller à", label: "Planning", picto: "cal", hint: "G P", run: go("/planning") },
      { id: "g-chevaux", group: "Aller à", label: "Chevaux", picto: "horse", hint: "G C", run: go("/chevaux") },
      { id: "g-equipe", group: "Aller à", label: "Tâches d’équipe", picto: "board", hint: "G E", run: go("/equipe") },
      { id: "g-mois", group: "Aller à", label: "Bilan du mois", sub: signed(c.net), picto: "euro", hint: "G M", run: go("/argent") },
      { id: "g-leviers", group: "Aller à", label: "Pistes pour gagner plus", picto: "bulb", hint: "G L", run: go("/argent?vue=leviers") },
      { id: "g-mouv", group: "Aller à", label: "Entrées et sorties d’argent", picto: "list", run: go("/argent?vue=mouvements") },
      { id: "g-bilans", group: "Aller à", label: "Bilans", sub: "3, 6 ou 12 mois", picto: "chart", run: go("/pilotage") },
      { id: "g-seuil", group: "Aller à", label: "Mon seuil de rentabilité", picto: "flag", run: go("/seuil") },
      { id: "g-fiche", group: "Aller à", label: "Ma fiche mon-ecurie.fr", sub: "places, tarifs, photos", picto: "flag", run: go("/ma-fiche") },
      { id: "g-prest", group: "Aller à", label: "Prestations et tarifs", sub: "cours, travail, balades", picto: "cours", run: go("/prestations") },
      { id: "g-clients", group: "Aller à", label: "Clients", picto: "personne", hint: "G K", run: go("/clients") },
      { id: "g-moi", group: "Aller à", label: "Mon écurie et réglages", picto: "reglages", run: go("/moi") },
      ...data.horses
        .filter((h) => !h.isArchived)
        .map((h) => ({ id: `h-${h.id}`, group: "Chevaux", label: h.name, sub: [h.pensionType, h.ownerName].filter(Boolean).join(" · "), face: h.id, run: go(`/ticket?id=${h.id}`) })),
      ...(data.people ?? [])
        .filter((p) => p.active)
        .map((p) => ({ id: `p-${p.id}`, group: "Clients", label: p.name, sub: p.role === "proprietaire" ? "propriétaire" : "cavalier", picto: "personne", run: go(`/clients?q=${encodeURIComponent(p.name)}`) })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, c],
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
    <>
      <div className="bs-scrim" onClick={close} />
      <div className="bs-palette" role="dialog" aria-modal="true" aria-label="Chercher ou faire">
        <label className="in">
          <Picto name="search" />
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
        </label>
        <div className="ls" id="bs-palette-list" role="listbox" ref={list}>
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
                  {horse ? <HorseFace horse={horse} size={26} /> : <Picto name={x.picto ?? "arrowR"} />}
                  <span className="l">
                    {x.label}
                    {x.sub && <small>{x.sub}</small>}
                  </span>
                  {x.hint && <kbd>{x.hint}</kbd>}
                </button>
              </div>
            );
          })}
        </div>
        <p className="ft">
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
    </>,
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
};

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
    ["À valider", ["G", "V"]],
    ["Chevaux", ["G", "C"]],
    ["Tâches d’équipe", ["G", "E"]],
    ["Le mois", ["G", "M"]],
    ["Leviers", ["G", "L"]],
    ["À facturer", ["G", "F"]],
    ["Bilans", ["G", "B"]],
    ["Prestations", ["G", "S"]],
    ["Clients", ["G", "K"]],
    ["Planning : semaine précédente, suivante", ["←", "→"]],
    ["Planning : revenir à aujourd’hui", ["T"]],
    ["Fermer une fenêtre", ["Échap"]],
  ];
  return createPortal(
    <>
      <div className="bs-scrim" onClick={close} />
      <div className="bs-dialog" role="dialog" aria-modal="true" aria-labelledby="bs-help-t">
        <button type="button" className="bs-x" onClick={close} aria-label="Fermer">
          <Picto name="x" size={20} />
        </button>
        <h2 id="bs-help-t" className="bs-d bs-t2">
          Raccourcis clavier
        </h2>
        <p className="bs-p">Pour aller vite sur ordinateur. « G puis A » : tape G, puis A.</p>
        <dl className="bs-keys">
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
    </>,
    document.body,
  );
}
