"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { Face, Ic, eurc } from "@/components/carnet/ui";
import { MAX_SEANCES, seriesDates } from "@/lib/domain/seances";
import { addDays } from "@/lib/domain/care";
import { applyCours, endOf, fromMin, type CoursHabit, type Draft, type Habitudes, type Rep } from "@/lib/domain/ajouter";
import type { Horse } from "@/lib/domain/types";
import { cleSouple, nomRetenu } from "@/lib/domain/proprio";
import { lireMontant, montantEnTexte, montantTape, saisieMontant, toucheMontant } from "@/lib/utils/montant";

/**
 * Les briques du + (feuille Ajouter) et des écrans /saisie : les chevaux en
 * puces, un champ avec son unité, les tuiles « déjà cochées » avec leur
 * sortie libre, la roue des heures, le pavé du montant, le jour. Et le
 * « Plus de détails » d'une séance : tout ce que l'ancien formulaire savait
 * faire (lieu, durée, places, prix, répétition, qui s'en occupe, cavaliers,
 * chevaux, notes).
 */
const NB = " ";

/* ---------- Formats ---------- */

/** « 18 h », « 7 h 30 ». */
export const hh = (t: string) => {
  const [h, m] = t.split(":");
  return `${Number(h)}${NB}h${m && m !== "00" ? `${NB}${m}` : ""}`;
};

/** « aujourd’hui », « demain », « jeudi 22 », « lundi 3 novembre ». */
export function jourLabel(date: string, today: string) {
  if (date === today) return "aujourd’hui";
  if (date === addDays(today, 1)) return "demain";
  const d = new Date(date + "T12:00:00");
  const wd = d.toLocaleDateString("fr-FR", { weekday: "long" });
  const sameMonth = date.slice(0, 7) === today.slice(0, 7);
  return `${wd} ${d.getDate()}${sameMonth ? "" : ` ${d.toLocaleDateString("fr-FR", { month: "long" })}`}`;
}
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- Briques partagées des saisies (feuille Ajouter et écrans /saisie) ---------- */

/** Les chevaux en puces avec leur tête ; un ou plusieurs selon `multi`. grille : trois colonnes, tous visibles (feuille du +). */
export function HorseChips({ horses, value, onChange, multi = true, wrap, grille }: { horses: Horse[]; value: string[]; onChange: (ids: string[]) => void; multi?: boolean; wrap?: boolean; grille?: boolean }) {
  return (
    <div className={`chips nt-faces${wrap ? " wrap" : ""}${grille ? " nt-fgrid" : ""}`}>
      {horses.map((h) => {
        const on = value.includes(h.id);
        return (
          <button
            key={h.id}
            type="button"
            className={`chip nt-fchip${on ? " on" : ""}`}
            aria-pressed={on}
            onClick={() => onChange(multi ? (on ? value.filter((x) => x !== h.id) : [...value, h.id]) : [h.id])}
          >
            <Face horse={h} />
            {h.name}
          </button>
        );
      })}
    </div>
  );
}

/** Un champ du carnet avec son vrai input dedans et l'unité à droite. */
export function InField({ children, unit, big, className = "" }: { children: ReactNode; unit?: ReactNode; big?: boolean; className?: string }) {
  return (
    <span className={`input nt-in${big ? " big" : ""} ${className}`}>
      {children}
      {unit && <span className="u">{unit}</span>}
    </span>
  );
}

/** Ajoute d'abord un cheval : le lien quand l'écurie est vide. */
export function NoHorse({ text }: { text: string }) {
  return (
    <Link href="/saisie/cheval" className="li nt-noh">
      <span className="ini">
        <Ic n="horse" />
      </span>
      <span>
        <b>Ajouter un cheval</b>
        <small>{text}</small>
      </span>
      <Ic n="chev" className="chev" />
    </Link>
  );
}

/* ---------- Les briques du + ---------- */

export type SetD = (f: (d: Draft) => Draft) => void;

/** Une question. */
export const Q = ({ children, em }: { children: ReactNode; em?: string }) => (
  <p className="nt-q">
    {children}
    {em && <em>{em}</em>}
  </p>
);

/** Des puces simples (une valeur). */
export function Puces<T extends string | number>({ options, value, onPick, scroll, extra }: { options: [T, ReactNode][]; value: T | null | undefined; onPick: (v: T) => void; scroll?: boolean; extra?: ReactNode }) {
  return (
    <div className={scroll ? "nt-scroll" : "nt-cs"}>
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" className={`chip${value === v ? " on" : ""}`} aria-pressed={value === v} onClick={() => onPick(v)}>
          {l}
        </button>
      ))}
      {extra}
    </div>
  );
}

/** Des puces à plusieurs (cavaliers, qui s'en occupe, étiquettes). */
export function Toggles({ options, value, onChange, scroll }: { options: string[]; value: string[]; onChange: (v: string[]) => void; scroll?: boolean }) {
  return (
    <div className={scroll ? "nt-scroll" : "nt-cs"}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" className={`chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Les réponses habituelles en tuiles, et la sortie libre : « Autre cours… »
 * ouvre un champ où l'on tape un nom qui n'existe pas encore.
 */
export function Tiles({
  options,
  value,
  onPick,
  otherLabel,
  otherOn,
  onOther,
  custom,
  onCustom,
  placeholder,
}: {
  options: { key: string; label: string; sub?: string }[];
  value: string | null;
  onPick: (k: string) => void;
  otherLabel: string;
  otherOn: boolean;
  onOther: () => void;
  custom: string;
  onCustom: (v: string) => void;
  placeholder: string;
}) {
  return (
    <>
      <div className="nt-tiles">
        {options.map((o) => (
          <button key={o.key} type="button" className={`nt-tile${!otherOn && value === o.key ? " on" : ""}`} aria-pressed={!otherOn && value === o.key} onClick={() => onPick(o.key)}>
            <b>{o.label}</b>
            {o.sub && <small>{o.sub}</small>}
          </button>
        ))}
        <button type="button" className={`nt-tile nt-oth${otherOn ? " on" : ""}`} aria-pressed={otherOn} onClick={onOther}>
          <b>{otherLabel}</b>
          <small>tape un nom</small>
        </button>
      </div>
      {otherOn && (
        <label className="input nt-tin">
          <input type="text" autoFocus value={custom} placeholder={placeholder} aria-label={placeholder} autoComplete="off" enterKeyHint="done" onChange={(e) => onCustom(e.target.value)} />
        </label>
      )}
    </>
  );
}

/** La roue des heures, de 6 h à 22 h par demi-heure ; l'heure choisie au centre. */
export function Wheel({ value, onPick, taskChip, onTask }: { value: string | null; onPick: (t: string) => void; taskChip?: boolean; onTask?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const hours = useMemo(() => {
    const out: string[] = [];
    for (let m = 6 * 60; m <= 22 * 60; m += 30) out.push(fromMin(m));
    if (value && !out.includes(value)) out.push(value);
    return out.sort();
  }, [value]);
  useEffect(() => {
    const w = ref.current;
    const on = w?.querySelector<HTMLElement>(".on");
    if (w) w.scrollLeft = on ? on.offsetLeft - (w.clientWidth - on.offsetWidth) / 2 : (w.scrollWidth - w.clientWidth) / 2;
  }, [value]);
  return (
    <>
      {taskChip && (
        <div className="nt-cs nt-tsk">
          <button type="button" className={`chip${value == null ? " on" : ""}`} aria-pressed={value == null} onClick={onTask}>
            Sans heure, c’est une tâche
          </button>
        </div>
      )}
      <div className="nt-wheel" ref={ref}>
        {hours.map((t) => (
          <button key={t} type="button" className={t === value ? "on" : ""} aria-pressed={t === value} onClick={() => onPick(t)}>
            {hh(t)}
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * Le pavé du montant. `sens` signe et colore le montant (argent qui rentre ou
 * qui sort). Sans bouton OK, la dernière touche est la virgule : les
 * centimes se tapent (« 12,50 € »).
 */
export function Keypad({ value, onChange, onOk, sens }: { value: number; onChange: (n: number) => void; onOk?: () => void; sens?: "in" | "out" }) {
  const [txt, setTxt] = useState(() => montantEnTexte(value));
  // Le montant changé d'ailleurs (remis à zéro, prérempli) : le texte suit.
  const shown = (lireMontant(txt) ?? 0) === (value || 0) ? txt : montantEnTexte(value);
  const press = (k: string) => {
    const t = toucheMontant(shown, k);
    setTxt(t);
    onChange(lireMontant(t) ?? 0);
  };
  const n = value || 0;
  return (
    <div className="nt-kp">
      <div className={`nt-amt${n ? "" : " ph"}`} aria-live="polite">
        {n ? <span className={sens ? (sens === "in" ? "in" : "out") : undefined}>{`${sens ? (sens === "in" ? "+" : "−") : ""}${montantTape(shown)}`}</span> : `0${NB}€`}
      </div>
      <div className="nt-pad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
          <button key={k} type="button" onClick={() => press(k)}>
            {k}
          </button>
        ))}
        <button type="button" onClick={() => press("del")} aria-label="Effacer un chiffre">
          <Ic n="back" className="" />
        </button>
        <button type="button" onClick={() => press("0")}>
          0
        </button>
        {onOk ? (
          <button type="button" className="ok" onClick={onOk}>
            OK
          </button>
        ) : (
          <button type="button" onClick={() => press(",")} aria-label="Virgule, pour les centimes">
            ,
          </button>
        )}
      </div>
    </div>
  );
}

/** Quel jour ? Aujourd’hui, Demain, ou un autre jour (les deux semaines à venir, ou une date). */
export function Quand({ date, today, onDate }: { date: string; today: string; onDate: (d: string) => void }) {
  const tomorrow = addDays(today, 1);
  const near = date === today || date === tomorrow;
  const [open, setOpen] = useState(false);
  const days = Array.from({ length: 12 }, (_, i) => addDays(today, i + 2));
  return (
    <>
      <div className="nt-q3">
        <button type="button" className={date === today ? "on" : ""} onClick={() => (onDate(today), setOpen(false))}>
          Aujourd’hui
        </button>
        <button type="button" className={date === tomorrow ? "on" : ""} onClick={() => (onDate(tomorrow), setOpen(false))}>
          Demain
        </button>
        <button type="button" className={near ? "" : "on"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {near ? "Autre jour" : cap(jourLabel(date, today))}
        </button>
      </div>
      {open && (
        <div className="nt-pick">
          <p className="nt-pl">Quel jour ?</p>
          <Jours date={date} today={today} days={days} onDate={(d) => (onDate(d), setOpen(false))} />
        </div>
      )}
    </>
  );
}

/** Les jours en puces, puis une date libre (hier, ou plus loin). */
export function Jours({ date, today, days, onDate }: { date: string; today: string; days?: string[]; onDate: (d: string) => void }) {
  const list = days ?? Array.from({ length: 14 }, (_, i) => addDays(today, i));
  return (
    <>
      <div className="nt-scroll">
        {list.map((d) => (
          <button key={d} type="button" className={`chip${d === date ? " on" : ""}`} aria-pressed={d === date} onClick={() => onDate(d)}>
            {cap(jourLabel(d, today))}
          </button>
        ))}
      </div>
      <input className="input nt-date" type="date" value={date} onChange={(e) => e.target.value && onDate(e.target.value)} aria-label="Une autre date" />
    </>
  );
}

/** Un champ de « Plus de détails ». */
export const F = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <div className="nt-f">
    <p className="nt-fl">
      {label}
      {hint && <span>{hint}</span>}
    </p>
    {children}
  </div>
);

/** Un montant tapé au clavier (Plus de détails). */
export function MoneyField({ value, onChange, placeholder = "0", label }: { value: number | null; onChange: (n: number | null) => void; placeholder?: string; label: string }) {
  const [txt, setTxt] = useState(montantEnTexte(value));
  return (
    <InField unit="€">
      <input
        inputMode="decimal"
        placeholder={placeholder}
        aria-label={label}
        value={txt}
        onChange={(e) => {
          const v = saisieMontant(e.target.value);
          setTxt(v);
          const n = lireMontant(v);
          onChange(n && n > 0 ? n : null);
        }}
      />
    </InField>
  );
}

const REPEATS: [Rep, string][] = [
  ["once", "Une fois"],
  ["weekly", "Chaque semaine"],
  ["biweekly", "Toutes les 2 semaines"],
  ["monthly", "Chaque mois"],
];

/** Répétition et « jusqu’au », avec le nombre de fois. */
export function Repetition({ d, set, options = REPEATS }: { d: Draft; set: SetD; options?: [Rep, string][] }) {
  const n = seriesDates(d.date, d.rep, d.until).length;
  return (
    <>
      <Puces options={options} value={d.rep} onPick={(rep) => set((x) => ({ ...x, rep }))} />
      {d.rep !== "once" && (
        <label className="field nt-until">
          <span>Jusqu’au</span>
          <InField
            unit={
              <b>
                {n} fois{n >= MAX_SEANCES ? " (c’est le maximum)" : ""}
              </b>
            }
          >
            <input type="date" value={d.until} onChange={(e) => e.target.value && set((x) => ({ ...x, until: e.target.value }))} />
          </InField>
        </label>
      )}
    </>
  );
}

/** Les tuiles des cours : les habituels, puis « Autre cours… ». */
export function CoursTiles({ d, set, h, other, setOther, onDone }: { d: Draft; set: SetD; h: Habitudes; other: boolean; setOther: (b: boolean) => void; onDone?: () => void }) {
  // Un prix jamais saisi n'apparaît pas ; l'heure, seulement si c'est une vraie habitude.
  const opts = h.cours.slice(0, 5).map((c: CoursHabit) => ({ key: c.key, label: c.label, sub: [c.price ? eurc(c.price) : "", c.habit ? hh(c.start) : ""].filter(Boolean).join(" · ") || undefined }));
  return (
    <Tiles
      options={opts}
      value={d.coursKey}
      onPick={(k) => {
        setOther(false);
        set((x) => {
          const c = h.cours.find((y) => y.key === k);
          const n = { ...x };
          if (c) applyCours(n, c);
          return n;
        });
        onDone?.();
      }}
      otherLabel="Autre cours…"
      otherOn={other || !!d.custom}
      onOther={() => setOther(true)}
      custom={d.custom}
      onCustom={(v) => set((x) => ({ ...x, custom: v, ...(v.trim() && x.coursKey ? { coursKey: null, price: null, places: null } : {}) }))}
      placeholder="Tape le nom du cours"
    />
  );
}

/**
 * Plus de détails, pour une séance : tout, sur une page qui défile.
 */
export function SeanceDetails({ d, set, h, today }: { d: Draft; set: SetD; h: Habitudes; today: string }) {
  const data = useDataStore();
  const gerant = useSettingsStore((s) => s.gerant);
  const horses = data.horses.filter((x) => !x.isArchived);
  const people = (data.people ?? []).filter((p) => p.active);
  const team = [gerant, ...(data.team ?? []).filter((m) => m.role === "employe").map((m) => m.name)].filter(Boolean);
  const lieux = [...new Set(["Carrière", "Manège", "Extérieur", ...(data.seances ?? []).map((s) => s.lieu).filter((x): x is string => !!x)])].slice(0, 6);
  const [other, setOther] = useState(!!d.custom);
  // Le nom tapé vit dans le brouillon : « C’est bon » l'inscrit même sans « Ajouter ».
  const typed = d.cavTape ?? "";
  const setTyped = (cavTape: string) => set((x) => ({ ...x, cavTape }));
  const start = d.start ?? "18:00";
  const q = cleSouple(typed);
  const sugg = q ? people.filter((p) => cleSouple(p.name).includes(q) && !d.cav.includes(p.name)).slice(0, 6) : [];
  const addCav = (n: string) => {
    const v = nomRetenu(
      people.map((p) => p.name),
      n,
    );
    if (!v || v.includes(",") || d.cav.some((x) => cleSouple(x) === cleSouple(v))) return setTyped("");
    set((x) => ({ ...x, cav: [...x.cav, v], cavTape: "" }));
  };
  return (
    <>
      <F label="Le cours">
        <CoursTiles d={d} set={set} h={h} other={other} setOther={setOther} />
      </F>
      <F label="Quel jour">
        <Jours date={d.date} today={today} onDate={(date) => set((x) => ({ ...x, date }))} />
      </F>
      <F label="À quelle heure">
        <Wheel value={start} onPick={(t) => set((x) => ({ ...x, start: t }))} />
        <input className="input nt-date" type="time" value={start} onChange={(e) => e.target.value && set((x) => ({ ...x, start: e.target.value }))} aria-label="Heure précise" />
      </F>
      <F label="Durée" hint={`fin à ${hh(endOf(start, d.dur))}`}>
        <Puces
          options={[
            [45, "45 min"],
            [60, `1${NB}h`],
            [90, `1${NB}h${NB}30`],
            [120, `2${NB}h`],
          ]}
          value={d.dur}
          onPick={(dur) => set((x) => ({ ...x, dur }))}
        />
      </F>
      <F label="Lieu">
        <Puces options={lieux.map((l) => [l, l] as [string, string])} value={d.lieu} onPick={(lieu) => set((x) => ({ ...x, lieu: x.lieu === lieu ? "" : lieu }))} />
      </F>
      <F label="Places">
        <div className="nt-step">
          <button type="button" aria-label="Une place de moins" onClick={() => set((x) => ({ ...x, places: Math.max(1, (x.places ?? 1) - 1) }))}>
            −
          </button>
          <b>{d.places ?? "·"}</b>
          <button type="button" aria-label="Une place de plus" onClick={() => set((x) => ({ ...x, places: Math.min(30, (x.places ?? 0) + 1) }))}>
            +
          </button>
        </div>
      </F>
      <F label="Prix par cavalier">
        <MoneyField value={d.price} onChange={(price) => set((x) => ({ ...x, price }))} placeholder="Ajouter un prix" label="Prix par cavalier" />
      </F>
      <F label="Répétition">
        <Repetition d={d} set={set} />
      </F>
      {team.length > 0 && (
        <F label="Qui s’en occupe ?">
          <Toggles options={team} value={d.qui} onChange={(qui) => set((x) => ({ ...x, qui }))} />
        </F>
      )}
      <F label="Cavaliers" hint="ou plus tard, depuis la séance">
        {d.cav.length > 0 && (
          <div className="nt-cs">
            {d.cav.map((n) => (
              <button key={n} type="button" className="chip on" aria-label={`Retirer ${n}`} onClick={() => set((x) => ({ ...x, cav: x.cav.filter((y) => y !== n) }))}>
                {n} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
        <InField className="nt-tin">
          <input value={typed} placeholder="Tape un nom" aria-label="Tape un nom de cavalier" onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCav(typed))} />
          {typed.trim() && (
            <button type="button" className="lnk" onClick={() => addCav(typed)}>
              Ajouter
            </button>
          )}
        </InField>
        {sugg.length > 0 && (
          <div className="nt-cs">
            {sugg.map((p) => (
              <button key={p.id} type="button" className="chip" onClick={() => addCav(p.name)}>
                + {p.name}
              </button>
            ))}
          </div>
        )}
      </F>
      {horses.length > 0 && (
        <F label="Chevaux">
          <HorseChips horses={horses} value={d.horseIds} onChange={(horseIds) => set((x) => ({ ...x, horseIds }))} />
        </F>
      )}
      <F label="Notes">
        <textarea className="input ta nt-ta" rows={2} placeholder="Ex. Prévoir les longes" aria-label="Notes" value={d.notes} onChange={(e) => set((x) => ({ ...x, notes: e.target.value }))} />
      </F>
    </>
  );
}
