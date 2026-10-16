"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { CountUp, Ic, Ill, sg } from "@/components/carnet/ui";
import { useUiStore } from "@/stores/ui-store";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";
import { usePaniers } from "@/components/bs/paniers";
import { OBSTACLE_META, useParcours } from "@/components/bs/parcours";
import { AideBouton, BILAN, CLIENTS_CHEVAUX, isRoot, titreDe, under, usePlusGroups, useRetour, useSuiviNavigation, type PlusItem } from "@/components/bs/nav";

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
      <AideBouton className="help" />
      <button type="button" className="ac-me" onClick={() => setRond(true)} aria-haspopup="dialog" aria-expanded={rond} aria-label="Ta fiche, tes tarifs, tes réglages et tout le reste">
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
 * La feuille du rond : tout ce que contenait le Menu, rangé en quatre
 * groupes, avec la recherche en tête et les premiers pas tant qu'ils ne sont
 * pas finis.
 */
export function RondSheet({ onClose }: { onClose: () => void }) {
  const s = useSettingsStore();
  const ini = useInitiale();
  const groups = usePlusGroups();
  const { current, n } = useParcours();
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
                <small>{s.stableName}</small>
              </span>
            </span>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          <div className="pad">
            <Link href="/recherche" className="input ac-find" onClick={onClose}>
              <Ic n="search" className="cn-ic sm" />
              Chercher un cheval, un client…
            </Link>
            {current && (
              <Link href="/parcours" className="card ac-pas" onClick={onClose}>
                <Ill n="rosette" />
                <span>
                  <span className="k">
                    Tes premiers pas · {n} sur 6
                  </span>
                  <b>Prochaine étape : {OBSTACLE_META[current].title.toLowerCase()}</b>
                  <span className="dots" aria-hidden="true">
                    {Array.from({ length: 6 }, (_, i) => (
                      <i key={i} className={i < n ? "on" : ""} />
                    ))}
                  </span>
                </span>
                <Ic n="chev" className="chev" />
              </Link>
            )}
            {groups.map((g) => (
              <div key={g.title} className="ac-grp">
                <p className="k">{g.title}</p>
                {g.items.map((it) => (
                  <PlusLigne key={it.id} it={it} onDone={onClose} />
                ))}
              </div>
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

/**
 * La barre d'onglets : Accueil, Planning, +, Clients et chevaux (le nombre
 * de paniers à valider), Mon mois (le chiffre du mois, qui compte quand il
 * change, et un « +X € » qui s'envole quand de l'argent rentre).
 */
export function TabBar() {
  const path = usePathname() ?? "";
  const openNoter = useUiStore((s) => s.openNoter);
  const ready = useDataStore((s) => s.hydrated);
  const paniers = usePaniers();
  const count = ready ? paniers.count : 0;
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
  const tone = Math.round(net) > 0 ? "in" : Math.round(net) < 0 ? "out" : "";
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
        <Link href="/chevaux" aria-current={on(CLIENTS_CHEVAUX)} aria-label={`Clients et chevaux${count ? ` : ${count} panier${count > 1 ? "s" : ""} à valider` : ""}`}>
          <span className="ac-ic">
            <Ic n="people" />
            {count > 0 && (
              <em className="ac-badge" aria-hidden="true">
                {count}
              </em>
            )}
          </span>
          <span className="ac-two" aria-hidden="true">
            Clients et
            <br />
            chevaux
          </span>
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
