"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { DayBlock, moneyCls } from "@/components/bs/day-block";
import { ligneDe, retirer } from "@/components/bs/retirer";
import { Ic, Ill, sg } from "@/components/carnet/ui";
import { clientsAFairePayer, demandePresence, estCollectif } from "@/lib/domain/compte-auto";
import type { DayItem } from "@/lib/domain/seances";
import type { StableData } from "@/lib/domain/types";
import { localToday } from "@/lib/utils/local-date";

/**
 * Tout compte, tu retires : les morceaux d'écran partagés par l'accueil, la
 * tournée du matin et « Ce qui a compté ». Une ligne passée montre qu'elle a
 * compté, avec × pour la retirer si elle n'a pas eu lieu (ou « Qui était
 * là ? » pour un cours à plusieurs). Styles : app/carnet/accueil2.css (cp-).
 */

const hhmm = (d = new Date()) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const pl = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Le jour et l'heure, remis à jour chaque minute. */
export function useMaintenant() {
  const [now, setNow] = useState(() => ({ today: localToday(), time: hhmm() }));
  useEffect(() => {
    const t = setInterval(() => setNow({ today: localToday(), time: hhmm() }), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/**
 * La fin du mois (les 3 derniers jours et les 5 premiers du mois suivant) :
 * les clients qui doivent encore pour le mois qui se termine. Hors de cette
 * période : null.
 */
export function useFinDuMois() {
  const hydrated = useDataStore((s) => s.hydrated);
  const data = useDataStore(useShallow((s) => ({ horses: s.horses, revenues: s.revenues, revenueCategories: s.revenueCategories, people: s.people, payments: s.payments })));
  const { today } = useMaintenant();
  return useMemo(() => {
    if (!hydrated) return null;
    const r = clientsAFairePayer(data as unknown as StableData, today);
    if (!r) return null;
    const enCours = today.slice(0, 7) === `${r.period.year}-${String(r.period.month).padStart(2, "0")}`;
    return { ...r, count: r.bills.length, total: r.bills.reduce((t, b) => t + b.due, 0), mois: MOIS[r.period.month - 1], enCours, today };
  }, [hydrated, data, today]);
}

/** « Fin du mois : 4 clients à faire payer », vers la liste des clients. */
export function BandeauFinDuMois({ className = "" }: { className?: string }) {
  const fin = useFinDuMois();
  if (!fin || !fin.count) return null;
  const jour = Number(fin.today.slice(8));
  const dernier = new Date(fin.period.year, fin.period.month, 0).getDate();
  const reste = dernier - jour;
  const quand = fin.enCours ? `${cap(fin.mois)} se termine ${reste === 0 ? "aujourd’hui" : reste === 1 ? "demain" : `dans ${reste} jours`}.` : `${cap(fin.mois)} est fini.`;
  return (
    <Link href="/chevaux?vue=clients" className={`card cp-ban rise ${className}`}>
      <Ill n="gerant-buste" alt="" />
      <span>
        <b>Fin du mois : {pl(fin.count, "client")} à faire payer</b>
        <small>{quand} Envoie à chacun ce qu’il te doit, puis touche « Il a payé ».</small>
      </span>
      <Ic n="chev" className="chev" />
    </Link>
  );
}

/**
 * Une ligne qui a compté : l'heure, ce que c'était, le montant signé, et ×
 * (« Pas eu lieu ? ») ou « Qui était là ? » pour un cours à plusieurs ou une
 * séance sans montant.
 */
export function LigneComptee({ it, time }: { it: DayItem; time?: string }) {
  const openSeance = useUiStore((s) => s.openSeance);
  const collectif = estCollectif(it);
  const presence = demandePresence(it);
  const open = () => it.seance && openSeance(it.seance.id, collectif ? "presence" : "fiche");
  return (
    <div className="row cp-row">
      <time>{time ?? it.start ?? "·"}</time>
      <span>
        <b>{it.title}</b>
        <small>
          <span className="cp-ok">
            <Ic n="ck" className="" />a compté
          </span>
          {it.sub ? ` · ${it.sub}` : ""}
        </small>
      </span>
      <span className={`amt ${moneyCls(it.money)}`}>{it.money ? sg(it.money) : ""}</span>
      <span className="cp-act">
        {presence && (
          <button type="button" className="cp-who" onClick={open}>
            Qui était là ?
          </button>
        )}
        {!collectif && (
          <button type="button" className="cp-rm" onClick={() => retirer(ligneDe(it))} aria-label={`Pas eu lieu ? Retirer : ${it.title}`}>
            <Ic n="x" className="" />
          </button>
        )}
      </span>
    </div>
  );
}

/** Une ligne à venir : on la regarde, un toucher ouvre la séance. Les tâches gardent leur coche. */
export function LigneAVenir({ it }: { it: DayItem }) {
  const openSeance = useUiStore((s) => s.openSeance);
  if (it.type === "task") return <DayBlock it={it} />;
  const body = (
    <>
      <b>{it.title}</b>
      {it.sub && <small>{it.sub}</small>}
    </>
  );
  return (
    <div className="row cp-row cp-next">
      <time>{it.start ?? "·"}</time>
      {it.seance ? (
        <button type="button" className="jr-open" onClick={() => openSeance(it.seance!.id)}>
          {body}
        </button>
      ) : (
        <span>{body}</span>
      )}
      <span className={`amt ${moneyCls(it.money)}`}>{it.money ? sg(it.money) : ""}</span>
    </div>
  );
}

/** Une ligne de la journée : comptée (passée) ou à venir. */
export function LigneJour({ it }: { it: DayItem }) {
  return it.type !== "task" && it.done ? <LigneComptee it={it} /> : <LigneAVenir it={it} />;
}
