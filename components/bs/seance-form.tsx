"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { Chips, Face, Ic, Seg, eur, sg } from "@/components/carnet/ui";
import { esc } from "@/components/bs/ui";
import { MAX_PLACES, MAX_SEANCES, seriesDates, type Repeat } from "@/lib/domain/seances";
import { addDays } from "@/lib/domain/care";
import { localToday } from "@/lib/utils/local-date";
import type { Horse, Seance } from "@/lib/domain/types";

/**
 * Ajouter une séance (repris du planning des cours du Clos) : prestation,
 * format, cavaliers, chevaux, quand, répétition. Le prix vient de la
 * prestation et se fige dans la séance ; le total prévu s'affiche avant
 * d'enregistrer. Une série crée au plus 60 séances sur 12 mois.
 */
const REPEATS: [Repeat, string][] = [
  ["once", "Une fois"],
  ["weekly", "Chaque semaine"],
  ["biweekly", "Toutes les 2 semaines"],
  ["monthly", "Chaque mois"],
];

const plusOneHour = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${String(Math.min(23, h + 1)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/* ---------- Briques partagées des saisies (feuille Noter et écrans /saisie) ---------- */

/** Les chevaux en puces avec leur tête ; un ou plusieurs selon `multi`. */
export function HorseChips({ horses, value, onChange, multi = true, wrap }: { horses: Horse[]; value: string[]; onChange: (ids: string[]) => void; multi?: boolean; wrap?: boolean }) {
  return (
    <div className={`chips nt-faces${wrap ? " wrap" : ""}`}>
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

export function SeanceForm({ onDone, date: presetDate, start: presetStart, prestationId }: { onDone: () => void; date?: string; start?: string; prestationId?: string }) {
  const data = useDataStore();
  const ensurePerson = useDataStore((s) => s.ensurePerson);
  const addSeances = useDataStore((s) => s.addSeances);
  const gerant = useSettingsStore((s) => s.gerant);
  const say = useUiStore((s) => s.say);
  const today = localToday();
  const prestations = (data.prestations ?? []).filter((p) => p.active);
  const horses = data.horses.filter((h) => !h.isArchived);
  const people = (data.people ?? []).filter((p) => p.active);

  const [prestId, setPrestId] = useState(prestations.find((p) => p.id === prestationId)?.id ?? prestations[0]?.id ?? "");
  const prest = prestations.find((p) => p.id === prestId);
  const [format, setFormat] = useState<"particulier" | "collectif">("collectif");
  const [places, setPlaces] = useState(6);
  const [names, setNames] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [horseIds, setHorseIds] = useState<string[]>([]);
  const [when, setWhen] = useState<"today" | "tomorrow" | "other">(presetDate && presetDate !== today ? "other" : "today");
  const [other, setOther] = useState(presetDate ?? addDays(today, 2));
  const [start, setStart] = useState(presetStart ?? "18:00");
  const [end, setEnd] = useState(plusOneHour(presetStart ?? "18:00"));
  const [repeat, setRepeat] = useState<Repeat>("once");
  const [until, setUntil] = useState(addDays(today, 84));
  const [more, setMore] = useState(false);
  const [lieu, setLieu] = useState("");
  const [notes, setNotes] = useState("");

  const date = when === "today" ? today : when === "tomorrow" ? addDays(today, 1) : other;
  const dates = useMemo(() => seriesDates(date, repeat, until), [date, repeat, until]);
  const isCollectif = !!prest?.hasFormat && format === "collectif";
  const maxP = prest?.hasFormat ? (isCollectif ? places : 1) : MAX_PLACES;
  const payers = Math.max(1, names.length || horseIds.length);
  const total = (prest?.price ?? 0) * payers * dates.length;
  const suggestionsList = typed.trim()
    ? people.filter((p) => p.name.toLowerCase().includes(typed.trim().toLowerCase()) && !names.includes(p.name)).slice(0, 6)
    : [];

  const problem = !prest
    ? "Choisis le type de séance."
    : end <= start
      ? "La fin doit venir après le début."
      : names.length > maxP
        ? `Trop de cavaliers : il y a ${maxP} place${maxP > 1 ? "s" : ""}.`
        : names.length === 0 && horseIds.length === 0
          ? "Ajoute un cavalier ou un cheval."
          : names.some((n) => n.includes(","))
            ? "Un nom ne peut pas contenir de virgule."
            : null;

  function addName(n: string) {
    const v = n.trim();
    if (!v || names.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    setNames([...names, v]);
    setTyped("");
  }

  function save() {
    if (problem || !prest) return;
    const participants = names.map((n, i) => {
      const owner = horses.find((h) => h.ownerName === n);
      const personId = ensurePerson(n, owner ? "proprietaire" : "cavalier");
      return { personId, horseId: owner?.id ?? (horseIds.length ? horseIds[i % horseIds.length] : undefined) };
    });
    const hName = horses.find((h) => h.id === horseIds[0])?.name;
    const title =
      prest.hasFormat && format === "particulier" && hName ? `Cours de ${hName}` : names.length === 1 && !prest.hasFormat ? `${prest.label} · ${names[0]}` : prest.label;
    const base: Omit<Seance, "id" | "date" | "rev" | "status" | "seriesId"> = {
      prestationId: prest.id,
      title,
      format: prest.hasFormat ? format : undefined,
      places: prest.hasFormat ? (isCollectif ? places : 1) : undefined,
      participants,
      horseIds,
      start,
      end,
      lieu: lieu.trim() || undefined,
      notes: notes.trim() || undefined,
      unitPrice: prest.price,
      updatedBy: gerant,
    };
    addSeances(base, dates);
    say(dates.length > 1 ? `<strong>${dates.length} séances</strong> ajoutées au planning : ${esc(title)}.` : `<strong>${esc(title)}</strong> : c’est au planning.`);
    onDone();
  }

  return (
    <div className="form nt-form">
      <div className="field">
        <span>Quel type de séance ?</span>
        <Chips value={prestId} onChange={setPrestId} options={prestations.map((p) => [p.id, `${p.label} · ${eur(p.price)}`] as [string, string])} />
      </div>
      {prest?.hasFormat && (
        <div className="nt-fmt">
          <Chips
            value={format}
            onChange={(f) => {
              setFormat(f);
              if (f === "collectif") setPlaces(6);
            }}
            options={[
              ["particulier", "Particulier"],
              ["collectif", "Collectif"],
            ]}
          />
          {isCollectif && (
            <div className="stepper sm">
              <button type="button" aria-label="Une place de moins" onClick={() => setPlaces(Math.max(1, places - 1))}>
                −
              </button>
              <b>{places}</b>
              <small>places</small>
              <button type="button" aria-label="Une place de plus" onClick={() => setPlaces(Math.min(MAX_PLACES, places + 1))}>
                +
              </button>
            </div>
          )}
        </div>
      )}

      <div className="field">
        <span>Cavaliers{prest?.hasFormat ? ` · ${names.length} sur ${maxP}` : ""}</span>
        {names.length > 0 && (
          <div className="chips">
            {names.map((n) => (
              <button key={n} type="button" className="chip on" aria-pressed onClick={() => setNames(names.filter((x) => x !== n))} aria-label={`Retirer ${n}`}>
                {n} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
        <InField>
          <input value={typed} placeholder="Nom du cavalier ou du propriétaire" onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addName(typed))} aria-label="Ajouter un cavalier" />
          {typed.trim() && (
            <button type="button" className="lnk" onClick={() => addName(typed)}>
              Ajouter
            </button>
          )}
        </InField>
        {suggestionsList.length > 0 && (
          <div className="chips">
            {suggestionsList.map((p) => (
              <button key={p.id} type="button" className="chip" onClick={() => addName(p.name)}>
                + {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {horses.length > 0 && (
        <div className="field">
          <span>Chevaux</span>
          <HorseChips horses={horses} value={horseIds} onChange={setHorseIds} />
        </div>
      )}

      <div className="field">
        <span>Quand ?</span>
        <Seg
          label="Jour"
          value={when}
          onChange={setWhen}
          options={[
            ["today", "Aujourd’hui"],
            ["tomorrow", "Demain"],
            ["other", "Autre jour"],
          ]}
        />
        {when === "other" && <input className="input" type="date" value={other} onChange={(e) => setOther(e.target.value)} aria-label="Date" />}
      </div>
      <div className="nt-two">
        <label className="field">
          <span>Début</span>
          <input
            className="input"
            type="time"
            value={start}
            onChange={(e) => {
              // La fin suit le début : la durée est gardée.
              const [h1, m1] = start.split(":").map(Number);
              const [h2, m2] = end.split(":").map(Number);
              const dur = h2 * 60 + m2 - (h1 * 60 + m1);
              const [h, m] = e.target.value.split(":").map(Number);
              const t = Math.min(23 * 60 + 59, h * 60 + m + Math.max(15, dur));
              setStart(e.target.value);
              setEnd(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
            }}
          />
        </label>
        <label className="field">
          <span>Fin</span>
          <input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>

      <div className="field">
        <span>Ça se répète ?</span>
        <Chips value={repeat} onChange={setRepeat} options={REPEATS} />
        {repeat !== "once" && (
          <label className="field nt-until">
            <span>Jusqu’au</span>
            <InField
              unit={
                <b>
                  {dates.length} séance{dates.length > 1 ? "s" : ""}
                  {dates.length >= MAX_SEANCES ? " (c’est le maximum)" : ""}
                </b>
              }
            >
              <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
            </InField>
          </label>
        )}
      </div>

      <div className="nt-more">
        <button type="button" className="lnk" onClick={() => setMore(!more)} aria-expanded={more}>
          Plus d’options
        </button>
        {more && (
          <>
            <label className="field">
              <span>Lieu</span>
              <input className="input" placeholder="Carrière, manège…" value={lieu} onChange={(e) => setLieu(e.target.value)} />
            </label>
            <label className="field">
              <span>Notes</span>
              <input className="input" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </>
        )}
      </div>

      <p className="note" role={problem ? "alert" : undefined}>
        {problem ? (
          <b>{problem}</b>
        ) : (
          <>
            Ça doit te rapporter <b>{eur(total)}</b> : {payers} × {eur(prest?.price ?? 0)}
            {dates.length > 1 ? `, sur ${dates.length} séances` : ""}.
          </>
        )}
      </p>
      <button type="button" className="btn full" disabled={!!problem} onClick={save}>
        {dates.length > 1 ? `Ajouter les ${dates.length} séances · ${sg(total)}` : `Ajouter au planning · ${sg(total)}`}
      </button>
    </div>
  );
}
