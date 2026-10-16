"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDesk } from "@/components/bs/desk";
import { WeekGrid } from "@/components/bs/week-grid";
import { PlanningTaches, PlanningTachesHaut } from "@/components/bs/planning-taches";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, cap } from "@/components/bs/ui";
import { CountUp, Empty, Ic, Seg, Sec, sg, type IllName } from "@/components/carnet/ui";
import { DayBlock, aCompte, iconOf, moneyCls } from "@/components/bs/day-block";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { dayItems, dayTones, seanceAmount, type DayItem } from "@/lib/domain/seances";
import { addDays, weekdayIndex } from "@/components/bs/dates";
import { localToday } from "@/lib/utils/local-date";

/**
 * Le planning (repris du planning des cours du Clos) : semaine ou mois,
 * puis la journée en liste ou en créneaux de 6 h à 21 h. Glisser change de
 * période ; toucher une heure vide ouvre l'ajout à cette heure. Chaque
 * élément porte son argent : vert ce qui rapporte, rose ce qui coûte.
 * Style : app/carnet/journee.css.
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
const nombre = (n: number) => String(Math.round(n));
/** « +75 » sans l'euro, pour les cases du mois. */
const court = (n: number) => sg(n).replace(/\s€$/, "");
/** Ce que la journée rapporte ou coûte : séances, soins, tâches avec un coût. */
const dayMoney = (its: DayItem[]) => its.reduce((t, i) => t + (i.money ?? 0), 0);

function Planning() {
  const data = useDataStore();
  const openNoter = useUiStore((s) => s.openNoter);
  const today = localToday();
  const now = hhmm();
  const [view, setView] = useState<"semaine" | "mois">(() => read("bs:planning-vue2", "semaine") as "semaine" | "mois");
  const [dayView, setDayView] = useState<"liste" | "creneaux">(() => read("bs:planning-jour2", "liste") as "liste" | "creneaux");
  const jour = useSearchParams().get("jour");
  const [sel, setSel] = useState(jour && /^\d{4}-\d{2}-\d{2}$/.test(jour) ? jour : today);
  const desk = useDesk();
  useEffect(() => write("bs:planning-vue2", view), [view]);
  useEffect(() => write("bs:planning-jour2", dayView), [dayView]);

  const monday = addDays(sel, -weekdayIndex(sel));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const monthStart = `${sel.slice(0, 7)}-01`;
  const gridStart = addDays(monthStart, -weekdayIndex(monthStart));
  const monthDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)).filter((d, i) => i < 35 || d.slice(0, 7) === sel.slice(0, 7));
  const rangeKey = view === "semaine" ? monday : sel.slice(0, 7);

  // Le bilan de la période : séances, ce qui a compté, ce qui reste prévu.
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
  const tasks = useMemo(() => {
    const done = data.taskLists?.find((l) => l.isDone)?.id;
    return (data.tasks ?? []).filter((t) => t.listId !== done).length;
  }, [data]);
  // Ce qui a compté : toujours à portée, en bas du planning (les tâches ont leur onglet en haut).
  const liens = (
    <nav className="jr-liens" aria-label="Aussi dans le planning">
      <Link href="/valider">
        <Ic n="ck" />
        <span>Ce qui a compté</span>
        <Ic n="chev" className="chev" />
      </Link>
    </nav>
  );
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
  const unit = view === "semaine" ? "Semaine" : "Mois";
  const viewSeg = (
    <Seg
      value={view}
      onChange={setView}
      label="Semaine ou mois"
      options={[
        ["semaine", "Semaine"],
        ["mois", "Mois"],
      ]}
    />
  );
  const trio = (soft: string) => (
    <div className="trio">
      <div>
        <b>
          <CountUp value={sum.count} fmt={nombre} />
        </b>
        <small>séance{sum.count > 1 ? "s" : ""}</small>
      </div>
      <div>
        <b className={moneyCls(sum.validated)}>{sg(sum.validated)}</b>
        <small>ont compté</small>
      </div>
      <div>
        <b className={soft}>{sg(sum.planned)}</b>
        <small>encore prévus</small>
      </div>
    </div>
  );

  /* ---------------- Ordinateur ---------------- */
  if (desk) {
    return (
      <Screen wide>
        <div className="jr-desk">
          <div style={{ marginBottom: 12 }}>
            <PlanningTaches value="planning" count={tasks} />
          </div>
          <div className="dhead">
            <div>
              <h3>Planning</h3>
              <div className="pnav">
                <button type="button" className="rb" onClick={() => shift(-1)} aria-label="Période précédente" title="Période précédente (←)">
                  <Ic n="back" />
                </button>
                <button type="button" className="rb" onClick={() => shift(1)} aria-label="Période suivante" title="Période suivante (→)">
                  <Ic n="chev" />
                </button>
                <b>{title}</b>
                <button type="button" className="chip" onClick={() => setSel(today)} disabled={view === "semaine" ? week.includes(today) : sel.slice(0, 7) === today.slice(0, 7)} title="Aujourd’hui (T)">
                  Aujourd’hui
                </button>
              </div>
            </div>
            <div className="pr">
              {trio("soft")}
              {viewSeg}
            </div>
          </div>
          {view === "semaine" ? (
            <WeekGrid days={week} today={today} now={now} onPickDay={(d) => openNoter({ mode: "seance", date: d })} />
          ) : (
            <>
              <div className="mhead">
                {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="mgrid">
                {monthDays.map((d) => {
                  const inMonth = d.slice(0, 7) === sel.slice(0, 7);
                  const its = inMonth ? dayItems(data, d, today, now) : [];
                  const money = dayMoney(its);
                  return (
                    <button
                      key={d}
                      type="button"
                      className={`mc${inMonth ? "" : " out"}${d === today ? " td" : d < today ? " past" : ""}`}
                      onClick={() => {
                        setSel(d);
                        setView("semaine");
                      }}
                      title="Voir la semaine"
                      aria-label={new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                    >
                      <span className="mn">
                        {Number(d.slice(8))}
                        {money ? <span className={moneyCls(money)}>{sg(money)}</span> : null}
                      </span>
                      {its.slice(0, 3).map((it) => (
                        <i key={it.key} style={{ textDecoration: it.done ? "line-through" : undefined }}>
                          {it.start ? `${it.start} ` : ""}
                          {it.title}
                        </i>
                      ))}
                      {its.length > 3 && <span className="more">+ {its.length - 3} autre{its.length > 4 ? "s" : ""}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <p className="legend2">
            <span>
              <span className="in">+</span> ce qui rapporte
            </span>
            <span>
              <span className="out">−</span> ce qui coûte
            </span>
            <span className="hint">Clique sur une heure libre pour ajouter quelque chose · Flèches ← → pour changer de {view === "semaine" ? "semaine" : "mois"} · T pour aujourd’hui</span>
          </p>
          {liens}
        </div>
      </Screen>
    );
  }

  /* ---------------- Téléphone ---------------- */
  const groups: [string, IllName, DayItem[]][] = [
    ["Le matin", "brouette", items.filter((i) => !i.start || i.start < "12:00")],
    ["L’après-midi", "carnet-buste", items.filter((i) => i.start && i.start >= "12:00" && i.start < "17:00")],
    ["Le soir", "foin", items.filter((i) => i.start && i.start >= "17:00")],
  ];
  const nowM = Number(now.slice(0, 2)) * 60 + Number(now.slice(3, 5));
  // Le soleil : de 6 h à 21 h sur l'arc (courbe de Bézier du dessin).
  const t = Math.min(1, Math.max(0, (nowM - 360) / 900));
  const sunTop = (((1 - t) ** 2 * 66 + 2 * (1 - t) * t * -14 + t * t * 66) / 66) * 100;

  return (
    <Screen>
      <PlanningTachesHaut value="planning" count={tasks} />
      <div
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, done: false })}
        onTouchMove={(e) => {
          const tc = touch.current;
          if (!tc || tc.done) return;
          const dx = e.touches[0].clientX - tc.x;
          const dy = e.touches[0].clientY - tc.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
            tc.done = true;
            shift(dx < 0 ? 1 : -1);
          }
        }}
      >
        <div className="jr-per rise" style={{ animationDelay: ".02s" }}>
          <span className="nav">
            <button type="button" onClick={() => shift(-1)} aria-label={`${unit} précédent${view === "semaine" ? "e" : ""}`}>
              <Ic n="back" className="" />
            </button>
            {title}
            <button type="button" onClick={() => shift(1)} aria-label={`${unit} suivant${view === "semaine" ? "e" : ""}`}>
              <Ic n="chev" className="" />
            </button>
          </span>
          {sel !== today && (
            <button type="button" className="lnk" onClick={() => setSel(today)}>
              Aujourd’hui
            </button>
          )}
        </div>
        <div className="jr-ttl rise" style={{ animationDelay: ".05s" }}>
          <h3>Planning</h3>
          {viewSeg}
        </div>

        {view === "semaine" ? (
          <>
            <div className="jr-days rise" style={{ animationDelay: ".12s" }}>
              {week.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={d === sel}
                  className={d === today ? "td" : ""}
                  onClick={() => setSel(d)}
                  aria-label={new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                >
                  {new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")}
                  <b>{Number(d.slice(8))}</b>
                  <span className="jr-dots">
                    {dayTones(data, d)
                      .slice(0, 3)
                      .map((_, i) => (
                        <i key={i} />
                      ))}
                  </span>
                </button>
              ))}
            </div>
            {sel === today && nowM >= 360 && nowM <= 1260 && (
              <div className="jr-ciel rise" style={{ animationDelay: ".16s" }} role="img" aria-label={`Il est ${Number(now.slice(0, 2))} h ${now.slice(3)}.`}>
                <div className="jr-arc">
                  <svg viewBox="0 0 300 66" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 66 Q150 -14 300 66" />
                  </svg>
                  <span className="jr-sun" style={{ left: `${t * 100}%`, top: `${sunTop}%` }}>
                    <em>{now.replace(/^0/, "")}</em>
                  </span>
                </div>
                <div className="jr-hours" aria-hidden="true">
                  <span>6 h</span>
                  <span>10 h</span>
                  <span>14 h</span>
                  <span>18 h</span>
                  <span>21 h</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="pad rise" style={{ animationDelay: ".12s" }}>
            <div className="jr-mhead">
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div className="jr-mgrid">
              {monthDays.map((d) => {
                const inMonth = d.slice(0, 7) === sel.slice(0, 7);
                const money = inMonth ? dayMoney(dayItems(data, d, today, now)) : 0;
                return (
                  <button
                    key={d}
                    type="button"
                    className={`jr-m${inMonth ? "" : " out"}${d === sel ? " sel" : d === today ? " td" : ""}`}
                    onClick={() => {
                      setSel(d);
                      setView("semaine");
                    }}
                    aria-label={new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                  >
                    <i>{Number(d.slice(8))}</i>
                    {money ? <em className={moneyCls(money)}>{court(money)}</em> : <em />}
                    <span className="jr-dots">
                      {inMonth &&
                        dayTones(data, d)
                          .slice(0, 3)
                          .map((_, i) => <s key={i} />)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="jr-legend">
              <span>
                <b className="in">+</b> la journée rapporte
              </span>
              <span>
                <b className="out">−</b> elle coûte
              </span>
              <span>
                <span className="jr-dots">
                  <s />
                </span>{" "}
                quelque chose de prévu
              </span>
            </div>
          </div>
        )}

        <div className="pad rise" style={{ animationDelay: ".2s", marginTop: view === "semaine" && sel === today ? 6 : 14 }}>
          {trio("jr-plan")}
        </div>
        {view === "mois" && (
          <div className="pad rise" style={{ animationDelay: ".26s" }}>
            <p className="note">Touche un jour pour ouvrir sa semaine.</p>
          </div>
        )}
      </div>

      {view === "semaine" && (
        <>
          <div className="jr-dayh rise" style={{ animationDelay: ".24s" }}>
            <b>{cap(new Date(sel + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" }))}</b>
            <Seg
              value={dayView}
              onChange={setDayView}
              label="Liste ou créneaux"
              options={[
                ["liste", "Liste"],
                ["creneaux", "Créneaux"],
              ]}
            />
          </div>
          {dayView === "liste" ? (
            items.length ? (
              groups
                .filter(([, , its]) => its.length)
                .map(([label, ill, its], i) => (
                  <Sec key={label} ill={ill} title={label} delay={0.28 + i * 0.08}>
                    <div className="rows">
                      {its.map((it) => (
                        <DayBlock key={it.key} it={it} />
                      ))}
                    </div>
                  </Sec>
                ))
            ) : (
              <div className="rise" style={{ animationDelay: ".28s" }}>
                <Empty>Rien de prévu {sel === today ? "aujourd’hui" : "ce jour-là"}. Touche le + pour prévoir une séance, un soin ou une tâche.</Empty>
                <div className="pad">
                  <button type="button" className="btn line full jr-addday" onClick={() => openNoter({ mode: "seance", date: sel })}>
                    <Ic n="plus" className="" />
                    Ajouter ce jour-là
                  </button>
                </div>
              </div>
            )
          ) : (
            <Creneaux items={items} isToday={sel === today} now={now} today={today} onEmpty={(h) => openNoter({ mode: "seance", date: sel, start: `${String(h).padStart(2, "0")}:00` })} />
          )}
        </>
      )}
      {liens}
      <div className="end" />
    </Screen>
  );
}

/** La journée en créneaux, de 6 h à 21 h (élargie si un bloc en sort). */
function Creneaux({ items, isToday, now, today, onEmpty }: { items: DayItem[]; isToday: boolean; now: string; today: string; onEmpty: (h: number) => void }) {
  const openSeance = useUiStore((s) => s.openSeance);
  const HOUR = 44;
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
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isToday && ref.current) window.scrollTo({ top: Math.max(0, ref.current.offsetTop + top(now) - 220), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday]);
  return (
    <>
      <div className="pad rise" style={{ animationDelay: ".28s" }}>
        {untimed.length > 0 && (
          <>
            <p className="k jr-k">Dans la journée</p>
            <div className="rows">
              {untimed.map((it) => (
                <DayBlock key={it.key} it={it} showTime={false} />
              ))}
            </div>
          </>
        )}
        <p className="jr-hint">
          <Ic n="plus" />
          Touche une heure libre pour ajouter quelque chose à cette heure.
        </p>
      </div>
      <div className="jr-grid" ref={ref} style={{ height: (last - first) * HOUR + 10 }}>
        {Array.from({ length: last - first + 1 }, (_, i) => (
          <div key={i} className="jr-h" style={{ top: i * HOUR }}>
            <span>{String(first + i).padStart(2, "0")}</span>
            {i < last - first && <button type="button" aria-label={`Ajouter à ${first + i} h`} onClick={() => onEmpty(first + i)} />}
          </div>
        ))}
        {placed.map(({ it, s, e, col, cols }) => {
          const w = `((100% - 34px) / ${cols})`;
          const h = Math.max(30, ((e - s) / 60) * HOUR - 3);
          const sub = [it.start, it.sub].filter(Boolean).join(" · ");
          return (
            <button
              key={it.key}
              type="button"
              className={`jr-ev${h < 40 ? " short" : ""}${cols > 1 ? " half" : ""}${it.done || aCompte(it) ? " done" : ""}`}
              onClick={() => it.seance && openSeance(it.seance.id)}
              aria-label={`${it.title}, ${sub}${it.money ? `, ${sg(it.money)}` : ""}`}
              style={{
                top: top(it.start!) + 1,
                height: h,
                left: `calc(34px + ${w} * ${col})`,
                width: `calc(${w} - 2px)`,
                cursor: it.seance ? "pointer" : "default",
              }}
            >
              <Ic n={iconOf(it)} />
              <span>
                <b>{it.title}</b>
                <small>{sub}</small>
              </span>
              {it.money ? <span className={moneyCls(it.money)}>{sg(it.money)}</span> : null}
            </button>
          );
        })}
        {isToday && mins(now) >= first * 60 && mins(now) <= last * 60 && (
          <div className="jr-now" style={{ top: top(now) }} role="img" aria-label={`Maintenant, ${now}`}>
            <em>{now.replace(/^0/, "")}</em>
          </div>
        )}
      </div>
    </>
  );
}
