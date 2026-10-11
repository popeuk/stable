"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDesk } from "@/components/bs/desk";
import { WeekGrid } from "@/components/bs/week-grid";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, cap, signed } from "@/components/bs/ui";
import { Picto } from "@/components/bs/picto";
import { DayBlock } from "@/components/bs/day-block";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { dayItems, dayTones, seanceAmount, toValidate, type DayItem, type Tone } from "@/lib/domain/seances";
import { addDays, weekdayIndex } from "@/components/bs/dates";
import { localToday } from "@/lib/utils/local-date";

/**
 * Le planning (repris du planning des cours du Clos) : semaine ou mois,
 * puis la journée en liste ou en créneaux de 6 h à 21 h. Glisser change de
 * période ; toucher une heure vide ouvre l'ajout à cette heure. Chaque
 * élément porte son argent : vert ce qui rapporte, rose ce qui coûte.
 */
export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <Planning />
      </Suspense>
    </ClientGate>
  );
}

const DOT: Record<Tone, string> = { g: "var(--vert)", r: "var(--rose)", o: "#8C6A35", n: "var(--ink-3)" };
const read = (k: string, d: string) => {
  try {
    return localStorage.getItem(k) ?? d;
  } catch {
    return d;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};
const hhmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function Planning() {
  const data = useDataStore();
  const openNoter = useUiStore((s) => s.openNoter);
  const today = localToday();
  const now = hhmm();
  const [view, setView] = useState<"semaine" | "mois">(() => read("bs:planning-vue", "semaine") as "semaine" | "mois");
  const [dayView, setDayView] = useState<"liste" | "creneaux">(() => read("bs:planning-jour", "creneaux") as "liste" | "creneaux");
  const jour = useSearchParams().get("jour");
  const [sel, setSel] = useState(jour && /^\d{4}-\d{2}-\d{2}$/.test(jour) ? jour : today);
  const desk = useDesk();
  useEffect(() => write("bs:planning-vue", view), [view]);
  useEffect(() => write("bs:planning-jour", dayView), [dayView]);

  const monday = addDays(sel, -weekdayIndex(sel));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const monthStart = `${sel.slice(0, 7)}-01`;
  const gridStart = addDays(monthStart, -weekdayIndex(monthStart));
  const monthDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)).filter((d, i) => i < 35 || d.slice(0, 7) === sel.slice(0, 7));
  const rangeKey = view === "semaine" ? monday : sel.slice(0, 7);

  // Le bilan de la période : séances, ce qui est validé, ce qui reste prévu.
  const sum = useMemo(() => {
    const days = view === "semaine" ? week : monthDays.filter((d) => d.slice(0, 7) === sel.slice(0, 7));
    const inR = new Set(days);
    const ss = (data.seances ?? []).filter((s) => inR.has(s.date) && s.status !== "cancelled");
    const done = ss.filter((s) => s.status === "done");
    // Les séances seules : les frais des soins vivent sur les tickets des chevaux.
    const validated = done.reduce((t, s) => t + seanceAmount(s), 0);
    const planned = ss.filter((s) => s.status === "planned").reduce((t, s) => t + seanceAmount(s), 0);
    return { count: ss.length, validated, planned };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, rangeKey, view]);
  const pending = useMemo(() => toValidate(data, today, now).length, [data, today, now]);
  const items = useMemo(() => dayItems(data, sel, today, now), [data, sel, today, now]);

  // Glisser à gauche ou à droite : la période suivante ou précédente.
  const touch = useRef<{ x: number; y: number; done: boolean } | null>(null);
  const shift = (dir: 1 | -1) => {
    if (view === "semaine") setSel(addDays(sel, 7 * dir));
    else {
      const [y, m] = sel.split("-").map(Number);
      setSel(new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10));
    }
  };

  // Ordinateur : ← et → changent de période, T revient à aujourd'hui.
  useEffect(() => {
    if (!desk) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      const ui = useUiStore.getState();
      if (ui.noterOpen || ui.seanceId || ui.paletteOpen || ui.helpOpen) return;
      if (e.key === "ArrowLeft") shift(-1);
      else if (e.key === "ArrowRight") shift(1);
      else if (e.key.toLowerCase() === "t") setSel(today);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const title =
    view === "semaine"
      ? `Semaine du ${Number(monday.slice(8))} ${new Date(monday + "T12:00:00").toLocaleDateString("fr-FR", { month: "long" })}`
      : cap(new Date(sel + "T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));

  if (desk) {
    const nav = (
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button type="button" className="bs-back" style={{ margin: 0, minHeight: 30 }} onClick={() => shift(-1)} aria-label="Période précédente" title="Période précédente (←)">
          <Picto name="chevL" />
        </button>
        <button type="button" className="bs-back" style={{ margin: 0, minHeight: 30 }} onClick={() => shift(1)} aria-label="Période suivante" title="Période suivante (→)">
          <Picto name="chev" />
        </button>
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-1)", marginLeft: 4, whiteSpace: "nowrap" }}>{title}</span>
        <button type="button" className="bs-chip" style={{ marginLeft: 10, height: 30 }} onClick={() => setSel(today)} disabled={view === "semaine" ? week.includes(today) : sel.slice(0, 7) === today.slice(0, 7)} title="Aujourd’hui (T)">
          Aujourd’hui
        </button>
      </span>
    );
    return (
      <Screen wide>
        <div className="bs-dhead">
          <div>
            <h1 className="bs-d bs-t1">Planning</h1>
            <div style={{ marginTop: 8 }}>{nav}</div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="bs-sum3" style={{ margin: 0, width: 360, maxWidth: "100%" }}>
              <div>
                <b>{sum.count}</b>
                <span>séances</span>
              </div>
              <div>
                <b style={{ color: "var(--vert)" }}>{signed(sum.validated)}</b>
                <span>validés</span>
              </div>
              <div>
                <b style={{ color: "var(--ink-3)" }}>{signed(sum.planned)}</b>
                <span>encore prévus</span>
              </div>
            </div>
            <div className="bs-seg" style={{ margin: 0, width: 180 }}>
              <button type="button" aria-pressed={view === "semaine"} onClick={() => setView("semaine")}>
                Semaine
              </button>
              <button type="button" aria-pressed={view === "mois"} onClick={() => setView("mois")}>
                Mois
              </button>
            </div>
          </div>
        </div>
        {pending > 0 && (
          <Link href="/valider" className="bs-banner" style={{ marginTop: 14 }}>
            <Picto name="clock" />
            <span style={{ flex: 1 }}>
              <b>{pending} à valider</b> · les séances passées attendent ta coche
            </span>
            <Picto name="chev" />
          </Link>
        )}
        {view === "semaine" ? (
          <WeekGrid days={week} today={today} now={now} onPickDay={(d) => openNoter({ mode: "seance", date: d })} />
        ) : (
          <>
            <div className="bs-mhead big" style={{ marginTop: 16 }}>
              {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="bs-mgrid big" style={{ marginTop: 6 }}>
              {monthDays.map((d) => {
                const inMonth = d.slice(0, 7) === sel.slice(0, 7);
                const its = inMonth ? dayItems(data, d, today, now) : [];
                const money = its.reduce((t, i) => t + (i.type === "seance" ? (i.money ?? 0) : 0), 0);
                return (
                  <button
                    key={d}
                    type="button"
                    className={`${inMonth ? "" : "out"}${d === today ? " td" : ""}`}
                    onClick={() => {
                      setSel(d);
                      setView("semaine");
                    }}
                    title="Voir la semaine"
                  >
                    <span style={{ display: "flex", width: "100%" }}>
                      {Number(d.slice(8))}
                      {money ? <span className="tot">{signed(money)}</span> : null}
                    </span>
                    {its.slice(0, 3).map((it) => (
                      <span key={it.key} className="ttl" style={{ background: { g: "var(--vert-soft)", r: "var(--rose-soft)", o: "#F5ECDC", n: "var(--mist)" }[it.tone], opacity: it.done ? 0.6 : 1 }}>
                        {it.start ? `${it.start} ` : ""}
                        {it.title}
                      </span>
                    ))}
                    {its.length > 3 && <span className="more">+ {its.length - 3} autre{its.length > 4 ? "s" : ""}</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <div className="bs-legend" style={{ marginTop: 12 }}>
          {(
            [
              ["g", "rapporte"],
              ["r", "coûte"],
              ["o", "écurie"],
            ] as [Tone, string][]
          ).map(([t, l]) => (
            <span key={t}>
              <i style={{ background: DOT[t] }} />
              {l}
            </span>
          ))}
          <span style={{ marginLeft: "auto", color: "var(--ink-3)" }}>Clique une heure vide pour planifier · ← → pour changer de semaine</span>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, done: false })}
        onTouchMove={(e) => {
          const t = touch.current;
          if (!t || t.done) return;
          const dx = e.touches[0].clientX - t.x;
          const dy = e.touches[0].clientY - t.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
            t.done = true;
            shift(dx < 0 ? 1 : -1);
          }
        }}
      >
        <div className="bs-over">
          <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button type="button" className="bs-back" style={{ margin: 0, minHeight: 28 }} onClick={() => shift(-1)} aria-label="Période précédente">
              <Picto name="chevL" />
            </button>
            {title}
            <button type="button" className="bs-back" style={{ margin: 0, minHeight: 28 }} onClick={() => shift(1)} aria-label="Période suivante">
              <Picto name="chev" />
            </button>
          </span>
          {sel !== today && (
            <button type="button" className="bs-link" onClick={() => setSel(today)}>
              Aujourd’hui
            </button>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h1 className="bs-d bs-t1">Planning</h1>
          <div className="bs-seg" style={{ margin: 0, width: 150 }}>
            <button type="button" aria-pressed={view === "semaine"} onClick={() => setView("semaine")}>
              Semaine
            </button>
            <button type="button" aria-pressed={view === "mois"} onClick={() => setView("mois")}>
              Mois
            </button>
          </div>
        </div>

        {pending > 0 && (
          <Link href="/valider" className="bs-banner">
            <Picto name="clock" />
            <span style={{ flex: 1 }}>
              <b>{pending} à valider</b> · les séances passées attendent
            </span>
            <Picto name="chev" />
          </Link>
        )}

        {view === "semaine" ? (
          <div className="bs-week">
            {week.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={d === sel}
                className={d === today ? "td" : ""}
                onClick={() => setSel(d)}
                aria-label={new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              >
                {new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "narrow" }).toUpperCase()}
                <b>{Number(d.slice(8))}</b>
                <span className="bs-dots">
                  {dayTones(data, d).map((t, i) => (
                    <i key={i} style={{ background: DOT[t] }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="bs-mhead">
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div className="bs-mgrid">
              {monthDays.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`${d.slice(0, 7) !== sel.slice(0, 7) ? "out" : ""}${d === today ? " td" : ""}`}
                  onClick={() => {
                    setSel(d);
                    setView("semaine");
                  }}
                >
                  {Number(d.slice(8))}
                  <span className="bs-dots">
                    {d.slice(0, 7) === sel.slice(0, 7) &&
                      dayTones(data, d).map((t, i) => (
                        <i key={i} style={{ background: DOT[t] }} />
                      ))}
                  </span>
                </button>
              ))}
            </div>
            <div className="bs-legend">
              {(
                [
                  ["g", "rapporte"],
                  ["r", "coûte"],
                  ["o", "écurie"],
                ] as [Tone, string][]
              ).map(([t, l]) => (
                <span key={t}>
                  <i style={{ background: DOT[t] }} />
                  {l}
                </span>
              ))}
            </div>
          </>
        )}

        <div className="bs-sum3">
          <div>
            <b>{sum.count}</b>
            <span>séances</span>
          </div>
          <div>
            <b style={{ color: "var(--vert)" }}>{signed(sum.validated)}</b>
            <span>validés</span>
          </div>
          <div>
            <b style={{ color: "var(--ink-3)" }}>{signed(sum.planned)}</b>
            <span>encore prévus</span>
          </div>
        </div>
      </div>

      {view === "semaine" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{cap(new Date(sel + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" }))}</span>
            <div className="bs-seg" style={{ margin: 0, width: 150 }}>
              <button type="button" aria-pressed={dayView === "liste"} onClick={() => setDayView("liste")}>
                Liste
              </button>
              <button type="button" aria-pressed={dayView === "creneaux"} onClick={() => setDayView("creneaux")}>
                Créneaux
              </button>
            </div>
          </div>
          {dayView === "liste" ? (
            items.length ? (
              items.map((it) => <DayBlock key={it.key} it={it} />)
            ) : (
              <button type="button" className="bs-li tap" onClick={() => openNoter({ mode: "seance", date: sel })}>
                <span className="bs-pic soft">
                  <Picto name="plus" />
                </span>
                <span className="tx">
                  <b>Rien de prévu</b>
                  <span>planifier une séance, un soin ou une tâche</span>
                </span>
              </button>
            )
          ) : (
            <Creneaux items={items} isToday={sel === today} now={now} onEmpty={(h) => openNoter({ mode: "seance", date: sel, start: `${String(h).padStart(2, "0")}:00` })} />
          )}
        </>
      )}
    </Screen>
  );
}

/** La journée en créneaux, de 6 h à 21 h (élargie si un bloc en sort). */
function Creneaux({ items, isToday, now, onEmpty }: { items: DayItem[]; isToday: boolean; now: string; onEmpty: (h: number) => void }) {
  const openSeance = useUiStore((s) => s.openSeance);
  const HOUR = 52;
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const timed = items.filter((i) => i.start);
  const untimed = items.filter((i) => !i.start);
  const first = Math.min(6, ...timed.map((i) => Math.floor(mins(i.start!) / 60)));
  const last = Math.max(21, ...timed.map((i) => Math.ceil((mins(i.end ?? i.start!) + (i.end ? 0 : 45)) / 60)));
  const top = (t: string) => ((mins(t) - first * 60) / 60) * HOUR;
  // Les blocs qui se chevauchent se partagent la largeur.
  const placed = timed.map((it) => ({ it, s: mins(it.start!), e: mins(it.end ?? it.start!) + (it.end ? 0 : 45), col: 0, cols: 1 }));
  placed.forEach((p, idx) => {
    const overlap = placed.filter((q) => q !== p && q.s < p.e && p.s < q.e);
    const used = new Set(overlap.filter((q) => placed.indexOf(q) < idx).map((q) => q.col));
    while (used.has(p.col)) p.col++;
    p.cols = Math.max(p.cols, overlap.length + 1);
    for (const q of overlap) q.cols = Math.max(q.cols, p.cols);
  });
  const bg = { g: "var(--vert-soft)", r: "var(--rose-soft)", o: "#F5ECDC", n: "var(--mist)" };
  const fg = { g: "var(--vert-deep)", r: "#5E2240", o: "#5C4420", n: "var(--ink-2)" };
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isToday && ref.current) window.scrollTo({ top: Math.max(0, ref.current.offsetTop + top(now) - 220), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday]);
  return (
    <>
      {untimed.map((it) => (
        <DayBlock key={it.key} it={it} showTime={false} />
      ))}
      <div className="bs-grid" ref={ref} style={{ height: (last - first) * HOUR + 10 }}>
        {Array.from({ length: last - first }, (_, i) => (
          <div key={i} className="hr" style={{ top: i * HOUR + 6 }}>
            <button type="button" aria-label={`Ajouter à ${first + i} h`} onClick={() => onEmpty(first + i)} />
            <span>{String(first + i).padStart(2, "0")}</span>
          </div>
        ))}
        {placed.map(({ it, s, e, col, cols }) => {
          const w = `((100% - 40px) / ${cols})`;
          return (
            <button
              key={it.key}
              type="button"
              className="ev"
              onClick={() => it.seance && openSeance(it.seance.id)}
              style={{
                top: top(it.start!) + 6,
                height: Math.max(30, ((e - s) / 60) * HOUR - 3),
                left: `calc(38px + ${w} * ${col})`,
                width: `calc(${w} - 2px)`,
                background: bg[it.tone],
                color: fg[it.tone],
                opacity: it.done ? 0.55 : 1,
                boxShadow: it.late && !it.done ? "inset 0 0 0 1.5px var(--rose-ink)" : undefined,
              }}
            >
              <b>
                {it.title}
                {it.money ? <span style={{ float: "right", fontWeight: 700 }}>{signed(it.money)}</span> : null}
              </b>
              {it.sub}
            </button>
          );
        })}
        {isToday && mins(now) >= first * 60 && mins(now) <= last * 60 && <div className="now" style={{ top: top(now) + 6 }} />}
      </div>
    </>
  );
}
