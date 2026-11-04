"use client";

import { Fragment, useState } from "react";
import { aCompte, moneyClsIt, useCheck } from "@/components/bs/day-block";
import { ligneDe, retirer } from "@/components/bs/retirer";
import { sg } from "@/components/carnet/ui";
import { demandePresence, estCollectif } from "@/lib/domain/compte-auto";
import { isEmptySeance, type DayItem } from "@/lib/domain/seances";
import { heure } from "@/lib/utils/heure";
import { useUiStore } from "@/stores/ui-store";
import "@/app/carnet/bloc-rdv.css";

/**
 * La journée en blocs fins (version du Clos, maquette validée le 4 novembre
 * 2026) : un bloc par rendez-vous, l'heure et sa durée, le titre, le montant,
 * une coche ronde. Les données et les gestes restent ceux de la journée :
 * une tâche se coche ; une séance ou un soin passé a compté tout seul (coche
 * pleine) et se retire s'il n'a pas eu lieu ; un toucher sur une séance
 * l'ouvre. Le prochain est entouré d'encre, ce qui attend une réponse de rose.
 */

const minutes = (h?: string) => {
  if (!h) return null;
  const [a, b] = h.split(":").map(Number);
  return a * 60 + (b || 0);
};
const enHeure = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
function duree(it: DayItem): string {
  const a = minutes(it.start);
  const b = minutes(it.end);
  if (a === null || b === null || b <= a) return "";
  const d = b - a;
  return d < 60 ? `${d} min` : d % 60 ? `${Math.floor(d / 60)} h ${String(d % 60).padStart(2, "0")}` : `${d / 60} h`;
}
function dans(start: string | undefined, now: string): string {
  const a = minutes(start);
  const n = minutes(now);
  if (a === null || n === null) return "";
  const d = Math.max(0, a - n);
  const h = Math.floor(d / 60);
  const m = d % 60;
  return `Dans ${h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`}`;
}

const COCHE = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export function BlocRdv({ it, prochain, now }: { it: DayItem; prochain?: boolean; now: string }) {
  const check = useCheck();
  const openSeance = useUiStore((s) => s.openSeance);
  const [retrait, setRetrait] = useState(false);
  const compte = aCompte(it);
  const fait = it.type === "task" ? it.done : compte;
  // Une séance passée sans personne d'inscrit : on demande qui est venu.
  const attente = !!it.seance && compte && isEmptySeance(it.seance) && demandePresence(it);
  const ouvrir = it.seance ? () => openSeance(it.seance!.id, attente || (compte && estCollectif(it)) ? "presence" : "fiche") : undefined;
  const d = duree(it);
  const corps = (
    <>
      <span className="br-h">
        {it.start ? heure(it.start) : "—"}
        {d && <small>{d}</small>}
      </span>
      <span className="br-c">
        <span className="br-ti">{it.title}</span>
        {prochain && <span className="br-dans">{dans(it.start, now)}</span>}
        {attente && <span className="br-att">Personne d’inscrit : dis qui est venu</span>}
      </span>
    </>
  );
  return (
    <div className={`br${fait ? " fait" : ""}${prochain ? " prochain" : ""}${attente ? " attente" : ""}`}>
      {ouvrir ? (
        <button type="button" className="br-ouvrir" onClick={ouvrir} aria-label={`Ouvrir : ${it.title}`}>
          {corps}
        </button>
      ) : (
        <span className="br-ouvrir">{corps}</span>
      )}
      <span className={`br-m ${moneyClsIt(it)}`}>{it.money ? sg(it.money) : ""}</span>
      {it.type === "task" ? (
        <button type="button" className={`br-ok${it.done ? " on" : ""}`} aria-pressed={it.done} aria-label={it.done ? `${it.title} : fait` : `C’est fait : ${it.title}`} onClick={() => !it.done && check(it)}>
          {COCHE}
        </button>
      ) : compte ? (
        <button type="button" className="br-ok on" aria-expanded={retrait} aria-label={`A compté : ${it.title}. Pas eu lieu ?`} onClick={() => setRetrait((x) => !x)}>
          {COCHE}
        </button>
      ) : (
        <span className="br-ok" aria-hidden="true" />
      )}
      {retrait && (
        <div className="br-ask">
          Pas eu lieu ?
          <button type="button" onClick={() => (retirer(ligneDe(it)), setRetrait(false))}>
            Retirer
          </button>
          <button type="button" onClick={() => setRetrait(false)}>
            Garder
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Une journée en blocs : le trait de l'heure qu'il est (aujourd'hui), et les
 * créneaux libres de deux heures ou plus entre 8 h et 21 h, à toucher pour
 * ajouter. `onLibre` reçoit l'heure de début du créneau.
 */
export function JourneeBlocs({ items, now, aujourdhui, onLibre }: { items: DayItem[]; now: string; aujourdhui: boolean; onLibre?: (start: string) => void }) {
  const n = minutes(now) ?? 0;
  const prochain = aujourdhui ? items.find((i) => !i.done && !i.late && (minutes(i.start) ?? -1) > n) : undefined;
  const out: React.ReactNode[] = [];
  let debut = 8 * 60;
  let maintenant = !aujourdhui;
  const libre = (a: number, b: number) =>
    onLibre && b - a >= 120 ? (
      <button key={`libre-${a}`} type="button" className="br-libre" onClick={() => onLibre(enHeure(a))}>
        Libre de {heure(enHeure(a))} à {heure(enHeure(b))}
        <span>Ajouter</span>
      </button>
    ) : null;
  for (const it of items) {
    const a = minutes(it.start);
    if (a !== null) {
      const l = libre(debut, a);
      if (l) out.push(l);
      if (!maintenant && a > n) {
        out.push(
          <div key="maintenant" className="br-now">
            {heure(now)}
          </div>,
        );
        maintenant = true;
      }
    }
    out.push(<BlocRdv key={it.key} it={it} prochain={it === prochain} now={now} />);
    const b = minutes(it.end) ?? (a !== null ? a + 60 : null);
    if (b !== null) debut = Math.max(debut, b);
  }
  if (!maintenant && n >= 8 * 60 && n < 21 * 60) {
    const l = libre(debut, 21 * 60);
    if (l) out.push(l);
    out.push(
      <div key="maintenant" className="br-now">
        {heure(now)}
      </div>,
    );
  }
  return (
    <div className="br-jour">
      {out.map((x, i) => (
        <Fragment key={i}>{x}</Fragment>
      ))}
    </div>
  );
}

/** « 2 sur 6 faits », en barre fine. Une tâche compte quand elle est cochée, une séance quand elle a compté. */
export function Avancement({ items }: { items: DayItem[] }) {
  const faits = items.filter((i) => (i.type === "task" ? i.done : aCompte(i))).length;
  if (!items.length) return null;
  return (
    <div className="br-avance">
      <span className="br-barre" aria-hidden="true">
        <i style={{ width: `${(faits / items.length) * 100}%` }} />
      </span>
      <span>
        {faits} sur {items.length} fait{faits > 1 ? "s" : ""}
      </span>
    </div>
  );
}
