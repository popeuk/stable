"use client";

import { useEffect, useMemo, useRef } from "react";
import { cap, signed } from "@/components/bs/ui";
import { Ic, sg } from "@/components/carnet/ui";
import { lateLabel, moneyCls, useCheck } from "@/components/bs/day-block";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { dayItems, seanceAmount, type DayItem } from "@/lib/domain/seances";

/**
 * La semaine sur ordinateur : sept colonnes, une ligne par heure. Cliquer
 * une heure vide planifie à cette heure ; cliquer une séance ouvre sa
 * fiche ; la petite coche (au survol) valide d'un geste. Les éléments sans
 * heure (soins du jour, tâches) vivent dans la ligne « Journée ».
 * Le style est dans app/carnet/journee.css (sous .jr-desk).
 */
const HOUR = 36;
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const pad2 = (h: number) => String(h).padStart(2, "0");

type Placed = { it: DayItem; s: number; e: number; col: number; cols: number };

function place(items: DayItem[]): Placed[] {
  const placed = items
    .filter((i) => i.start)
    .map((it) => ({ it, s: mins(it.start!), e: Math.max(mins(it.end ?? it.start!), mins(it.start!) + (it.end ? 20 : 45)), col: 0, cols: 1 }));
  placed.forEach((p, idx) => {
    const overlap = placed.filter((q) => q !== p && q.s < p.e && p.s < q.e);
    const used = new Set(overlap.filter((q) => placed.indexOf(q) < idx).map((q) => q.col));
    while (used.has(p.col)) p.col++;
    p.cols = Math.max(p.cols, overlap.length + 1);
    for (const q of overlap) q.cols = Math.max(q.cols, p.cols);
  });
  return placed;
}

export function WeekGrid({ days, today, now, onPickDay }: { days: string[]; today: string; now: string; onPickDay: (d: string) => void }) {
  const data = useDataStore();
  const openSeance = useUiStore((s) => s.openSeance);
  const openNoter = useUiStore((s) => s.openNoter);
  const check = useCheck();
  const perDay = useMemo(() => days.map((d) => dayItems(data, d, today, now)), [data, days, today, now]);
  const timed = perDay.flat().filter((i) => i.start);
  const first = Math.min(7, ...timed.map((i) => Math.floor(mins(i.start!) / 60)));
  const last = Math.max(21, ...timed.map((i) => Math.ceil((mins(i.end ?? i.start!) + (i.end ? 0 : 45)) / 60)));
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const top = (m: number) => ((m - first * 60) / 60) * HOUR;
  const hasUntimed = perDay.some((l) => l.some((i) => !i.start));

  // À l'ouverture, la grille défile jusqu'à l'heure qu'il est (ou 8 h).
  const ref = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const body = bodyRef.current;
    if (!el || !body) return;
    const target = days.includes(today) ? mins(now) - 120 : 8 * 60;
    el.scrollTop = Math.max(0, body.offsetTop - (headRef.current?.offsetHeight ?? 0) + top(Math.max(first * 60, target)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0]]);

  const label = (it: DayItem) => `${it.start ? `${it.start}${it.end ? `-${it.end}` : ""} · ` : ""}${it.title}${it.sub ? `, ${it.sub}` : ""}${it.money ? `, ${signed(it.money)}` : ""}`;
  const open = (it: DayItem) => {
    if (it.seance) openSeance(it.seance.id);
    else if (!it.done) check(it);
  };

  return (
    <div className="wg" ref={ref}>
      <div className="wg-r wg-head" ref={headRef}>
        <span className="gut" />
        {days.map((d, i) => {
          const money = (data.seances ?? []).filter((x) => x.date === d && x.status !== "cancelled").reduce((t, x) => t + seanceAmount(x), 0);
          return (
            <button key={d} type="button" className={`dh${d === today ? " td" : ""}`} onClick={() => onPickDay(d)} title="Ajouter quelque chose ce jour-là">
              {cap(new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""))}
              <b>{Number(d.slice(8))}</b>
              <em className={moneyCls(money)}>{money ? sg(money) : perDay[i].length ? `${perDay[i].length} chose${perDay[i].length > 1 ? "s" : ""}` : " "}</em>
            </button>
          );
        })}
      </div>

      {hasUntimed && (
        <div className="wg-r wg-day">
          <span className="gut">Journée</span>
          {perDay.map((list, i) => (
            <span key={days[i]} className="jc">
              {list
                .filter((it) => !it.start)
                .map((it) => {
                  const late = lateLabel(it, today);
                  return (
                    <button
                      key={it.key}
                      type="button"
                      className={`jci${it.done ? " done" : ""}`}
                      onClick={() => open(it)}
                      title={it.done ? `${label(it)} (fait)` : `${label(it)} : clique pour confirmer que c’est fait`}
                      aria-label={it.done ? `${label(it)}, fait` : `Confirmer que c’est fait : ${label(it)}`}
                    >
                      {it.done && (
                        <span className="dk">
                          <Ic n="ck" className="" />
                        </span>
                      )}
                      <span>
                        {late ? <b>{it.title}</b> : it.title}
                        {late ? ` · ${late}` : it.sub ? ` · ${it.sub}` : ""}
                      </span>
                    </button>
                  );
                })}
            </span>
          ))}
        </div>
      )}

      <div className="wg-r wg-body" ref={bodyRef} style={{ height: hours.length * HOUR }}>
        <span className="gut hrs">
          {hours.map((h) => (
            <span key={h} style={{ top: (h - first) * HOUR }}>
              {pad2(h)}
            </span>
          ))}
        </span>
        {days.map((d, i) => (
          <span key={d} className={`col${d === today ? " td" : ""}`}>
            {hours.map((h) => (
              <button
                key={h}
                type="button"
                className="slot"
                style={{ top: (h - first) * HOUR, height: HOUR }}
                aria-label={`Ajouter quelque chose le ${new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" })} à ${h} h`}
                onClick={() => openNoter({ mode: "seance", date: d, start: `${pad2(h)}:00` })}
              />
            ))}
            {place(perDay[i]).map(({ it, s, e, col, cols }) => {
              const h = Math.max(24, ((e - s) / 60) * HOUR - 3);
              const short = h < 30;
              const money = it.money ? <span className={moneyCls(it.money)}>{sg(it.money)}</span> : null;
              return (
                <div
                  key={it.key}
                  role="button"
                  tabIndex={0}
                  className={`ev${short ? " short" : ""}${it.done ? " done" : ""}${it.late && !it.done ? " wait" : ""}`}
                  onClick={() => open(it)}
                  onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), open(it))}
                  aria-label={label(it)}
                  title={label(it)}
                  style={{
                    top: top(s) + 1,
                    height: h,
                    left: `calc(${(100 / cols) * col}% + 3px)`,
                    width: `calc(${100 / cols}% - 6px)`,
                  }}
                >
                  <b>
                    <span>{it.title}</span>
                    {it.done ? (
                      <span className="dk">
                        <Ic n="ck" className="" />
                      </span>
                    ) : short ? (
                      money
                    ) : null}
                  </b>
                  {!short && (
                    <small>
                      <span>{[it.sub, it.late && !it.done ? lateLabel(it, today) : ""].filter(Boolean).join(" · ") || it.start}</span>
                      {money}
                    </small>
                  )}
                  {!it.done && (
                    <button
                      type="button"
                      className="evck"
                      aria-label={`Confirmer que c’est fait : ${it.title}`}
                      title="C’est fait"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        check(it);
                      }}
                    >
                      <Ic n="ck" className="" />
                    </button>
                  )}
                </div>
              );
            })}
            {d === today && mins(now) >= first * 60 && mins(now) <= last * 60 && <span className="now" style={{ top: top(mins(now)) }} />}
          </span>
        ))}
      </div>
    </div>
  );
}
