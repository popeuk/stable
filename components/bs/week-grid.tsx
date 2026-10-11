"use client";

import { useEffect, useMemo, useRef } from "react";
import { Picto } from "@/components/bs/picto";
import { eur, signed } from "@/components/bs/ui";
import { useCheck } from "@/components/bs/day-block";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { dayItems, seanceAmount, type DayItem } from "@/lib/domain/seances";

/**
 * La semaine sur ordinateur : sept colonnes, une ligne par heure. Cliquer
 * une heure vide planifie à cette heure ; cliquer une séance ouvre sa
 * fiche ; la petite coche valide d'un geste. Les éléments sans heure
 * (soins du jour, tâches) vivent dans la ligne « Journée ».
 */
const HOUR = 48;
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const BG = { g: "var(--vert-soft)", r: "var(--rose-soft)", o: "#F5ECDC", n: "var(--mist)" } as const;
const FG = { g: "var(--vert-deep)", r: "#5E2240", o: "#5C4420", n: "var(--ink-2)" } as const;

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
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = days.includes(today) ? mins(now) - 120 : 8 * 60;
    el.scrollTop = Math.max(0, top(Math.max(first * 60, target)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0]]);

  const label = (it: DayItem) => `${it.start ? `${it.start}${it.end ? `-${it.end}` : ""} · ` : ""}${it.title}${it.sub ? `, ${it.sub}` : ""}${it.money ? `, ${signed(it.money)}` : ""}`;
  const open = (it: DayItem) => {
    if (it.seance) openSeance(it.seance.id);
    else if (!it.done) check(it);
  };

  return (
    <div className="bs-wg">
      <div className="bs-wg-head">
        <span />
        {days.map((d, i) => {
          const money = (data.seances ?? []).filter((x) => x.date === d && x.status !== "cancelled").reduce((t, x) => t + seanceAmount(x), 0);
          return (
            <button key={d} type="button" className={`d${d === today ? " td" : ""}`} onClick={() => onPickDay(d)} title="Planifier ce jour-là">
              <small>{new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")}</small>
              <b>{Number(d.slice(8))}</b>
              <em>{money ? eur(money) : perDay[i].length ? `${perDay[i].length} chose${perDay[i].length > 1 ? "s" : ""}` : ""}</em>
            </button>
          );
        })}
      </div>

      {hasUntimed && (
        <div className="bs-wg-day">
          <span>Journée</span>
          {perDay.map((list, i) => (
            <div key={days[i]}>
              {list
                .filter((it) => !it.start)
                .map((it) => (
                  <button
                    key={it.key}
                    type="button"
                    className="bs-wg-chip"
                    style={{ background: BG[it.tone], color: FG[it.tone], opacity: it.done ? 0.55 : 1, boxShadow: it.late && !it.done ? "inset 0 0 0 1.5px var(--rose-ink)" : undefined }}
                    onClick={() => open(it)}
                    title={it.done ? `${label(it)} (fait)` : `${label(it)} : cliquer pour valider`}
                    aria-label={it.done ? `${label(it)}, fait` : `Valider : ${label(it)}`}
                  >
                    {it.done && <Picto name="check" size={12} />}
                    <span>{it.title}</span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}

      <div className="bs-wg-body" ref={ref}>
        <div className="bs-wg-gut" style={{ height: hours.length * HOUR }}>
          {hours.map((h) => (
            <span key={h} style={{ top: (h - first) * HOUR }}>
              {h > first ? `${String(h).padStart(2, "0")} h` : ""}
            </span>
          ))}
        </div>
        {days.map((d, i) => (
          <div key={d} className={`bs-wg-col${d === today ? " td" : ""}`} style={{ height: hours.length * HOUR }}>
            {hours.map((h) => (
              <button
                key={h}
                type="button"
                className="slot"
                style={{ height: HOUR }}
                aria-label={`Planifier le ${new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" })} à ${h} h`}
                onClick={() => openNoter({ mode: "seance", date: d, start: `${String(h).padStart(2, "0")}:00` })}
              />
            ))}
            {place(perDay[i]).map(({ it, s, e, col, cols }) => (
              <div
                key={it.key}
                role="button"
                tabIndex={0}
                className="ev"
                onClick={() => open(it)}
                onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), open(it))}
                aria-label={label(it)}
                title={label(it)}
                style={{
                  top: top(s) + 1,
                  height: Math.max(26, ((e - s) / 60) * HOUR - 3),
                  left: `calc(${(100 / cols) * col}% + 3px)`,
                  width: `calc(${100 / cols}% - 6px)`,
                  background: BG[it.tone],
                  color: FG[it.tone],
                  opacity: it.done ? 0.6 : 1,
                  boxShadow: it.late && !it.done ? "inset 0 0 0 1.5px var(--rose-ink)" : undefined,
                }}
              >
                <b>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
                  {it.money ? <i>{signed(it.money)}</i> : null}
                </b>
                {(e - s) / 60 * HOUR > 40 && <span>{[it.start, it.sub].filter(Boolean).join(" · ")}</span>}
                {(e - s) / 60 * HOUR > 52 && (
                  <button
                    type="button"
                    className={`ck${it.done ? " on" : ""}`}
                    aria-label={it.done ? `${it.title} : fait` : `Valider : ${it.title}`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      if (!it.done) check(it);
                      else if (it.seance) openSeance(it.seance.id);
                    }}
                  >
                    <Picto name="check" />
                  </button>
                )}
              </div>
            ))}
            {d === today && mins(now) >= first * 60 && mins(now) <= last * 60 && <div className="now" style={{ top: top(mins(now)) }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
