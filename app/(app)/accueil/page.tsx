"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, Sec, cap, signed } from "@/components/bs/ui";
import { Picto } from "@/components/bs/picto";
import { GoalCard } from "@/components/bs/goal-card";
import { DayBlock } from "@/components/bs/day-block";
import { OBSTACLE_META, useParcours } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { dayItems, toValidate } from "@/lib/domain/seances";
import { suggestions } from "@/lib/domain/leviers";
import { currentPeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";

/**
 * L'accueil, le cockpit : l'objectif du mois, ce qui reste à valider, la
 * journée, et la prochaine action qui rapporte.
 */
export default function Page() {
  return (
    <ClientGate>
      <Accueil />
    </ClientGate>
  );
}

const hhmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function Accueil() {
  const data = useDataStore();
  const gerant = useSettingsStore((s) => s.gerant);
  const capacity = useSettingsStore((s) => s.capacity);
  const { current, n } = useParcours();
  const today = localToday();
  const now = hhmm();
  const items = useMemo(() => dayItems(data, today, today, now), [data, today, now]);
  const pending = useMemo(() => toValidate(data, today, now), [data, today, now]);
  const pendingMoney = pending.reduce((t, i) => t + (i.money ?? 0), 0);
  const action = useMemo(() => {
    const list = suggestions(data, currentPeriod(), capacity).filter((s) => s.status !== "faite");
    return list.find((s) => s.lever === "facturer") ?? list[0];
  }, [data, capacity]);
  const left = items.filter((i) => !i.done).length;

  return (
    <Screen>
      <p className="bs-over">
        <span>{cap(new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }))}</span>
      </p>
      <h1 className="bs-d bs-t1">Bonjour {gerant}</h1>
      <GoalCard />
      {pending.length > 0 && (
        <Link href="/valider" className="bs-banner">
          <Picto name="clock" />
          <span style={{ flex: 1 }}>
            <b>
              {pending.length} chose{pending.length > 1 ? "s" : ""} à valider
            </b>
            {pendingMoney ? ` · ${signed(pendingMoney)} en attente` : ""}
          </span>
          <Picto name="chev" />
        </Link>
      )}

      <Sec action={<Link href="/planning">Planning</Link>}>
        Aujourd’hui · {left} chose{left > 1 ? "s" : ""}
      </Sec>
      {items.length === 0 ? (
        <p className="bs-p">Rien de prévu aujourd’hui. Le + planifie une séance, un soin ou une tâche.</p>
      ) : (
        items.map((it) => <DayBlock key={it.key} it={it} />)
      )}

      {action && (
        <>
          <Sec action={<Link href="/argent?vue=leviers">Leviers</Link>}>L’action de la semaine</Sec>
          <Link href="/argent?vue=leviers" className="bs-act">
            <span className={`bs-pic ${action.lever === "facturer" ? "rose" : ""}`}>
              <Picto name={action.lever === "remplir" ? "box" : action.lever === "facturer" ? "euro" : "foin"} />
            </span>
            <span className="tx">
              <b>{action.title}</b>
              <span>{action.sub}</span>
            </span>
            <span className="bs-gain">
              +{Math.round(action.gain)} €<small>{action.unit}</small>
            </span>
          </Link>
        </>
      )}

      {current && (
        <Link href="/parcours" className="bs-card">
          <span className="bs-pic soft">
            <Picto name="flag" />
          </span>
          <div style={{ flex: 1 }}>
            <div className="k">Ton parcours · {n} sur 6</div>
            <b>Prochain obstacle : {OBSTACLE_META[current].title.toLowerCase()}</b>
          </div>
          <Picto name="arrowR" />
        </Link>
      )}
    </Screen>
  );
}
