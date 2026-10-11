"use client";

import { useMemo, useState } from "react";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { Picto } from "@/components/bs/picto";
import { HorseFace } from "@/components/bs/horse-face";
import { eur, esc } from "@/components/bs/ui";
import { MAX_PLACES, MAX_SEANCES, seriesDates, type Repeat } from "@/lib/domain/seances";
import { addDays } from "@/lib/domain/care";
import { localToday } from "@/lib/utils/local-date";
import type { Seance } from "@/lib/domain/types";

/**
 * Ajouter une séance (repris du planning des cours du Clos) : prestation,
 * format, cavaliers, chevaux, quand, répétition. Le prix vient de la
 * prestation et se fige dans la séance ; le total prévu s'affiche avant
 * d'enregistrer. Une série crée au plus 60 séances sur 12 mois.
 */
const REPEATS: [Repeat, string][] = [
  ["once", "Une fois"],
  ["weekly", "Chaque semaine"],
  ["biweekly", "Toutes les 2 sem."],
  ["monthly", "Chaque mois"],
];

const plusOneHour = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${String(Math.min(23, h + 1)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

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
    ? "Choisis une prestation."
    : end <= start
      ? "La fin doit venir après le début."
      : names.length > maxP
        ? `Trop de cavaliers : ${maxP} place${maxP > 1 ? "s" : ""}.`
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
    say(dates.length > 1 ? `<strong>${dates.length} séances</strong> planifiées : ${esc(title)}.` : `<strong>${esc(title)}</strong> planifiée.`);
    onDone();
  }

  return (
    <>
      <p className="bs-sec">Prestation</p>
      <div className="bs-chips">
        {prestations.map((p) => (
          <button key={p.id} type="button" className="bs-chip" aria-pressed={prestId === p.id} onClick={() => setPrestId(p.id)}>
            {p.label} · {eur(p.price)}
          </button>
        ))}
      </div>
      {prest?.hasFormat && (
        <div className="bs-chips" style={{ marginTop: 8 }}>
          <button type="button" className="bs-chip" aria-pressed={format === "particulier"} onClick={() => setFormat("particulier")}>
            Particulier
          </button>
          <button type="button" className="bs-chip" aria-pressed={format === "collectif"} onClick={() => { setFormat("collectif"); setPlaces(6); }}>
            Collectif
          </button>
          {isCollectif && (
            <span className="bs-chip" style={{ marginLeft: "auto", gap: 2, padding: "0 4px" }}>
              <button type="button" aria-label="Une place de moins" onClick={() => setPlaces(Math.max(1, places - 1))} style={{ width: 28, height: 28 }}>
                −
              </button>
              {places} places
              <button type="button" aria-label="Une place de plus" onClick={() => setPlaces(Math.min(MAX_PLACES, places + 1))} style={{ width: 28, height: 28 }}>
                +
              </button>
            </span>
          )}
        </div>
      )}

      <p className="bs-sec">
        <span>Cavaliers{prest?.hasFormat ? ` · ${names.length} sur ${maxP}` : ""}</span>
      </p>
      <div className="bs-chips">
        {names.map((n) => (
          <button key={n} type="button" className="bs-chip" aria-pressed onClick={() => setNames(names.filter((x) => x !== n))} aria-label={`Retirer ${n}`}>
            {n}
            <Picto name="x" />
          </button>
        ))}
      </div>
      <div className="bs-field">
        <input value={typed} placeholder="Un nom : cavalier ou propriétaire" onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addName(typed))} aria-label="Ajouter un cavalier" />
        {typed.trim() && (
          <button type="button" className="bs-link" onClick={() => addName(typed)}>
            Ajouter
          </button>
        )}
      </div>
      {suggestionsList.length > 0 && (
        <div className="bs-chips">
          {suggestionsList.map((p) => (
            <button key={p.id} type="button" className="bs-chip" onClick={() => addName(p.name)}>
              <Picto name="plus" />
              {p.name}
            </button>
          ))}
        </div>
      )}

      <p className="bs-sec">Chevaux</p>
      <div className="bs-faces">
        {horses.map((h) => {
          const on = horseIds.includes(h.id);
          return (
            <button key={h.id} type="button" className="bs-fpick" aria-pressed={on} onClick={() => setHorseIds(on ? horseIds.filter((x) => x !== h.id) : [...horseIds, h.id])}>
              <span className="ring">
                <HorseFace horse={h} size={38} />
              </span>
              {h.name}
            </button>
          );
        })}
      </div>

      <p className="bs-sec">Quand</p>
      <div className="bs-seg" role="group" aria-label="Jour">
        {(["today", "tomorrow", "other"] as const).map((w) => (
          <button key={w} type="button" aria-pressed={when === w} onClick={() => setWhen(w)}>
            {{ today: "Aujourd’hui", tomorrow: "Demain", other: "Autre jour" }[w]}
          </button>
        ))}
      </div>
      {when === "other" && (
        <div className="bs-field">
          <input type="date" value={other} onChange={(e) => setOther(e.target.value)} aria-label="Date" />
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label className="bs-field">
          <span>Début</span>
          <input
            type="time"
            value={start}
            style={{ textAlign: "right" }}
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
        <label className="bs-field">
          <span>Fin</span>
          <input type="time" value={end} style={{ textAlign: "right" }} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>

      <p className="bs-sec">Répétition</p>
      <div className="bs-chips">
        {REPEATS.map(([r, l]) => (
          <button key={r} type="button" className="bs-chip" aria-pressed={repeat === r} onClick={() => setRepeat(r)}>
            {r !== "once" && <Picto name="repeat" />}
            {l}
          </button>
        ))}
      </div>
      {repeat !== "once" && (
        <label className="bs-field">
          <span>Jusqu’au</span>
          <input type="date" value={until} style={{ textAlign: "right" }} onChange={(e) => setUntil(e.target.value)} />
          <b style={{ whiteSpace: "nowrap" }}>
            {dates.length} séance{dates.length > 1 ? "s" : ""}
            {dates.length >= MAX_SEANCES ? " (maximum)" : ""}
          </b>
        </label>
      )}

      <button type="button" className="bs-link" style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 4 }} onClick={() => setMore(!more)} aria-expanded={more}>
        Plus d’options
      </button>
      {more && (
        <>
          <div className="bs-field">
            <input placeholder="Lieu (carrière, manège…)" value={lieu} onChange={(e) => setLieu(e.target.value)} aria-label="Lieu" />
          </div>
          <div className="bs-field">
            <input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" />
          </div>
        </>
      )}

      <p className="bs-p" style={{ marginTop: 12, color: problem ? "var(--rose-ink)" : "var(--ink-2)" }}>
        {problem ?? `${dates.length} séance${dates.length > 1 ? "s" : ""} · ${payers} × ${eur(prest?.price ?? 0)} · ${eur(total)} prévus`}
      </p>
      <button type="button" className="bs-btn" style={{ marginTop: 8 }} disabled={!!problem} onClick={save}>
        {dates.length > 1 ? `Planifier ${dates.length} séances · +${eur(total)}` : `Planifier · +${eur(total)}`}
      </button>
    </>
  );
}
