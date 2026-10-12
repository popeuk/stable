"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, Sec, cap, eur, signed } from "@/components/bs/ui";
import { useDesk } from "@/components/bs/desk";
import { addDays, weekdayIndex } from "@/components/bs/dates";
import { billsFor } from "@/lib/domain/billing";
import { dayTones, seanceAmount, type Tone } from "@/lib/domain/seances";
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

  const desk = useDesk();
  const head = (
    <>
      <p className="bs-over">
        <span>{cap(new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }))}</span>
      </p>
      <h1 className="bs-d bs-t1">Bonjour {gerant}</h1>
    </>
  );
  const main = (
    <>
      <GoalCard />
      {pending.length > 0 && (
        <Link href="/valider" className="bs-banner">
          <Picto name="clock" />
          <span style={{ flex: 1 }}>
            <b>
              {pending.length} chose{pending.length > 1 ? "s" : ""} à confirmer
            </b>
            {pendingMoney ? ` · ${signed(pendingMoney)} t’attendent` : ""}
          </span>
          <Picto name="chev" />
        </Link>
      )}

      <Sec action={<Link href="/planning">Planning</Link>}>
        Aujourd’hui · {left} chose{left > 1 ? "s" : ""} à faire
      </Sec>
      {items.length === 0 ? (
        <p className="bs-p">Rien de prévu aujourd’hui. {desk ? "Clique sur « Ajouter » (ou touche N)" : "Touche le +"} pour prévoir une séance, un soin ou une tâche.</p>
      ) : (
        items.map((it) => <DayBlock key={it.key} it={it} />)
      )}
    </>
  );
  const extra = (
    <>
      {action && (
        <>
          <Sec action={<Link href="/argent?vue=leviers">Toutes les pistes</Link>}>Une piste pour gagner plus</Sec>
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
            <div className="k">Ton parcours · {n} étape{n > 1 ? "s" : ""} sur 6</div>
            <b>Prochain obstacle : {OBSTACLE_META[current].title.toLowerCase()}</b>
          </div>
          <Picto name="arrowR" />
        </Link>
      )}
    </>
  );

  if (!desk)
    return (
      <Screen>
        {head}
        {main}
        {extra}
      </Screen>
    );
  return (
    <Screen wide>
      {head}
      <div className="bs-cockpit">
        <div>{main}</div>
        <div className="side">
          <WeekGlance />
          <BillsGlance />
          <TeamGlance />
          {extra}
        </div>
      </div>
    </Screen>
  );
}

const DOT: Record<Tone, string> = { g: "var(--vert)", r: "var(--rose)", o: "#8C6A35", n: "var(--ink-3)" };

/** La semaine d'un coup d'œil : chaque jour, ses points et ce qu'il rapporte. */
function WeekGlance() {
  const data = useDataStore();
  const today = localToday();
  const monday = addDays(today, -weekdayIndex(today));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return (
    <>
      <Sec action={<Link href="/planning">Planning</Link>}>Cette semaine</Sec>
      <div className="bs-week" style={{ marginTop: 6 }}>
        {days.map((d) => {
          const money = (data.seances ?? []).filter((x) => x.date === d && x.status !== "cancelled").reduce((t, x) => t + seanceAmount(x), 0);
          return (
            <Link key={d} href={`/planning?jour=${d}`} className={d === today ? "td" : ""} aria-current={d === today ? "date" : undefined} style={{ textAlign: "center", padding: "6px 0 7px", borderRadius: 4, fontSize: 11, color: "var(--ink-3)", background: d === today ? "#fff" : undefined, boxShadow: d === today ? "inset 0 0 0 1px var(--line)" : undefined }}>
              {new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")}
              <b style={{ display: "block", fontSize: 16, color: d === today ? "var(--vert)" : "var(--ink-1)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{Number(d.slice(8))}</b>
              <span className="bs-dots">
                {dayTones(data, d).map((t, i) => (
                  <i key={i} style={{ background: DOT[t] }} />
                ))}
              </span>
              <span style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: "var(--vert)", minHeight: 14, fontVariantNumeric: "tabular-nums" }}>{money ? `${Math.round(money)} €` : ""}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

/** Ce qui reste à encaisser ce mois, les plus gros d'abord. */
function BillsGlance() {
  const data = useDataStore();
  const bills = useMemo(() => billsFor(data, currentPeriod()).filter((b) => b.due > 0).sort((a, b) => b.due - a.due), [data]);
  if (!bills.length) return null;
  const total = bills.reduce((t, b) => t + b.due, 0);
  return (
    <>
      <Sec action={<Link href="/argent?vue=facturer">Tout voir</Link>}>On te doit encore · {eur(total)}</Sec>
      {bills.slice(0, 4).map((b) => (
        <Link key={b.payer} href="/argent?vue=facturer" className="bs-li tap" style={{ padding: "8px 0" }}>
          <span className="bs-ini" style={{ width: 28, height: 28, fontSize: 10.5 }}>
            {b.payer
              .split(/\s+/)
              .map((x) => x[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <span className="tx">
            <b>{b.payer}</b>
          </span>
          <span className="bs-amt">{eur(b.due)}</span>
        </Link>
      ))}
    </>
  );
}

/** Les tâches d'équipe qui comptent aujourd'hui : en retard, du jour, en cours. */
function TeamGlance() {
  const data = useDataStore();
  const today = localToday();
  const done = data.taskLists?.find((l) => l.isDone)?.id;
  const doing = data.taskLists?.find((l) => !l.isDone && /cours/i.test(l.title))?.id;
  const tasks = (data.tasks ?? [])
    .filter((t) => t.listId !== done && ((t.due && t.due.slice(0, 10) <= today) || t.listId === doing))
    .slice(0, 4);
  if (!tasks.length) return null;
  return (
    <>
      <Sec action={<Link href="/equipe">Voir les tâches</Link>}>L’équipe</Sec>
      {tasks.map((t) => (
        <Link key={t.id} href="/equipe" className="bs-li tap" style={{ padding: "8px 0" }}>
          <span className="bs-pic sm">
            <Picto name="board" />
          </span>
          <span className="tx">
            <b>{t.title}</b>
            <span className={t.due && t.due.slice(0, 10) < today ? "bs-late" : ""}>
              {[t.forWho.join(", "), t.due ? (t.due.slice(0, 10) < today ? "en retard" : t.due.slice(0, 10) === today ? "aujourd’hui" : "") : "en cours"].filter(Boolean).join(" · ")}
            </span>
          </span>
        </Link>
      ))}
    </>
  );
}
