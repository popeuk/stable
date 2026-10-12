"use client";

import { useEffect, useState } from "react";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { Picto } from "@/components/bs/picto";
import { HorseFace } from "@/components/bs/horse-face";
import { Toggle, eur, esc, signed } from "@/components/bs/ui";
import { seanceAmount } from "@/lib/domain/seances";
import type { Seance } from "@/lib/domain/types";

/**
 * La fiche d'une séance : la valider (feuille de présence), l'annuler avec
 * un motif, la modifier ou la supprimer avec une portée (cette séance, les
 * suivantes, toute la série). Toute validation ou annulation propose
 * « Annuler » pendant 6 secondes.
 */
const REASONS = ["Météo", "Cheval boiteux", "Cavalier absent", "Imprévu"];

export function SeanceSheet() {
  const id = useUiStore((s) => s.seanceId);
  const seance = useDataStore((s) => (id ? s.seances?.find((x) => x.id === id) : undefined));
  if (!id || !seance) return null;
  return <Inner key={id} seance={seance} />;
}

function snapshot() {
  const st = useDataStore.getState();
  return { seances: st.seances, revenues: st.revenues };
}

function Inner({ seance }: { seance: Seance }) {
  const view0 = useUiStore((s) => s.seanceView);
  const close = useUiStore((s) => s.closeSeance);
  const say = useUiStore((s) => s.say);
  const data = useDataStore();
  const st = useDataStore.getState;
  const gerant = useSettingsStore((s) => s.gerant);
  const [view, setView] = useState<"fiche" | "presence" | "annuler" | "modifier" | "supprimer">(view0);
  const [presence, setPresence] = useState<Record<string, boolean>>(
    Object.fromEntries(seance.participants.map((p) => [p.personId, p.present ?? true])),
  );
  const [chargeAbsent, setChargeAbsent] = useState(!!seance.chargeAbsent);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(seance.date);
  const [start, setStart] = useState(seance.start);
  const [end, setEnd] = useState(seance.end);
  const [notes, setNotes] = useState(seance.notes ?? "");
  const [scope, setScope] = useState<"one" | "following" | "all">("one");

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [close]);

  const person = (pid: string) => data.people?.find((p) => p.id === pid);
  const horse = (hid?: string) => data.horses.find((h) => h.id === hid);
  const series = seance.seriesId ? (data.seances ?? []).filter((x) => x.seriesId === seance.seriesId) : [];
  const following = series.filter((x) => x.date >= seance.date).length;
  const absents = seance.participants.filter((p) => presence[p.personId] === false).length;
  const paying = seance.participants.length ? seance.participants.length - (chargeAbsent ? 0 : absents) : Math.max(1, seance.horseIds.length);
  const amount = seance.unitPrice * paying;
  const dateLabel = new Date(seance.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  function validate() {
    const snap = snapshot();
    st().validateSeance(seance.id, presence, chargeAbsent);
    say(`${esc(seance.title)} : c’est fait, <strong>${signed(amount)}</strong> sur les tickets.`, () => useDataStore.setState(snap));
    close();
  }
  function cancel() {
    const snap = snapshot();
    st().cancelSeance(seance.id, reason);
    say(`Séance annulée : ${esc(seance.title)}${reason ? ` (${esc(reason.toLowerCase())})` : ""}. Rien n’est compté.`, () => useDataStore.setState(snap));
    close();
  }
  function saveEdit() {
    const patch: Partial<Seance> = { updatedBy: gerant };
    if (date !== seance.date) patch.date = date;
    if (start !== seance.start) patch.start = start;
    if (end !== seance.end) patch.end = end;
    if ((notes || undefined) !== seance.notes) patch.notes = notes || undefined;
    const snap = snapshot();
    st().updateSeance(seance.id, patch, seance.seriesId ? scope : "one");
    const n = scope === "one" || !seance.seriesId ? 1 : scope === "following" ? following : series.length;
    say(`Enregistré pour ${n} séance${n > 1 ? "s" : ""}.`, () => useDataStore.setState(snap));
    close();
  }
  function remove() {
    const snap = snapshot();
    st().deleteSeance(seance.id, seance.seriesId ? scope : "one");
    say("Séance supprimée.", () => useDataStore.setState(snap));
    close();
  }

  const scopePicker =
    seance.seriesId ? (
      <>
        <p className="bs-sec">Pour quelles séances ?</p>
        {(
          [
            ["one", "Cette séance seulement", dateLabel],
            ["following", "Celle-ci et les suivantes", `${following} séance${following > 1 ? "s" : ""}`],
            ["all", "Toutes les séances de la série", `${series.length} séances, déjà faites comprises`],
          ] as const
        ).map(([k, t, sub]) => (
          <button key={k} type="button" className="bs-li tap" onClick={() => setScope(k)} aria-pressed={scope === k}>
            <span className={`bs-ck${scope === k ? " on" : ""}`} style={{ margin: 0, width: 32, height: 32 }}>
              <i>
                <Picto name="check" />
              </i>
            </span>
            <span className="tx">
              <b>{t}</b>
              <span>{sub}</span>
            </span>
          </button>
        ))}
      </>
    ) : null;

  return (
    <>
      <div className="bs-scrim" onClick={close} />
      <div className="bs-sheet" role="dialog" aria-modal="true" aria-label={seance.title}>
        <div className="bs-grab" />
        <button type="button" className="bs-x" onClick={close} aria-label="Fermer">
          <Picto name="x" size={20} />
        </button>
        <p className="bs-over" style={{ marginTop: 0 }}>
          <span>
            {dateLabel} · {seance.start}-{seance.end}
            {seance.lieu ? ` · ${seance.lieu}` : ""}
          </span>
        </p>
        <h2 className="bs-d bs-t2" style={{ marginRight: 40 }}>
          {view === "presence" ? `${seance.title} · qui était là ?` : seance.title}
        </h2>

        {view === "fiche" && (
          <>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              <span className={`bs-pill ${seance.status === "done" ? "g" : seance.status === "cancelled" ? "n" : "r"}`}>
                {seance.status === "done" ? "Faite" : seance.status === "cancelled" ? `Annulée${seance.cancelReason ? ` · ${seance.cancelReason}` : ""}` : "Prévue"}
              </span>
              <span className="bs-pill n">
                {eur(seance.unitPrice)} {seance.participants.length ? "par cavalier" : "par cheval"}
              </span>
              {seance.seriesId && <span className="bs-pill n">revient, {series.length} séances en tout</span>}
            </div>
            <p className="bs-sec">{seance.participants.length ? "Cavaliers" : "Chevaux"}</p>
            {(seance.participants.length ? seance.participants : seance.horseIds.map((h) => ({ personId: "", horseId: h, present: undefined }))).map((p, i) => {
              const h = horse(p.horseId);
              return (
                <div key={p.personId || p.horseId || i} className="bs-li">
                  {h ? <HorseFace horse={h} size={34} /> : <span className="bs-ini">{(person(p.personId)?.name ?? "?").slice(0, 2)}</span>}
                  <span className="tx">
                    <b>{person(p.personId)?.name ?? h?.name}</b>
                    <span>{h && p.personId ? `sur ${h.name}` : ""}</span>
                  </span>
                  {seance.status === "done" && p.personId && <span className={`bs-pill ${p.present === false ? "r" : "g"}`}>{p.present === false ? "absent" : "présent"}</span>}
                </div>
              );
            })}
            {seance.notes && <p className="bs-p" style={{ marginTop: 10 }}>{seance.notes}</p>}
            {seance.updatedBy && <p className="bs-p" style={{ fontSize: 12, marginTop: 8 }}>Modifiée par {seance.updatedBy}</p>}
            <div className="bs-card" style={{ justifyContent: "space-between" }}>
              <span className="k">{seance.status === "done" ? "A rapporté" : "Rapportera"}</span>
              <b className="bs-big" style={{ fontSize: 22, color: "var(--vert)" }}>{signed(seanceAmount(seance))}</b>
            </div>
            {seance.status === "planned" && (
              <button type="button" className="bs-btn" style={{ marginTop: 12 }} onClick={() => (seance.participants.length > 1 ? setView("presence") : validate())}>
                <Picto name="check" />
                {seance.participants.length > 1 ? "Confirmer et dire qui était là" : `Confirmer que c’est fait · ${signed(amount)}`}
              </button>
            )}
            {seance.status !== "planned" && (
              <button
                type="button"
                className="bs-btn line"
                style={{ marginTop: 12 }}
                onClick={() => {
                  const snap = snapshot();
                  st().unvalidateSeance(seance.id);
                  say("La séance repasse à « prévue ».", () => useDataStore.setState(snap));
                  close();
                }}
              >
                {seance.status === "done" ? "Remettre en « prévue »" : "Remettre la séance au planning"}
              </button>
            )}
            <div style={{ display: "grid", gridTemplateColumns: seance.status === "planned" ? "1fr 1fr 1fr" : "1fr 1fr", gap: 6, marginTop: 6 }}>
              {seance.status === "planned" && (
                <button type="button" className="bs-btn line" onClick={() => setView("annuler")}>
                  Annulée
                </button>
              )}
              <button type="button" className="bs-btn line" onClick={() => setView("modifier")}>
                Modifier
              </button>
              <button type="button" className="bs-btn line" style={{ color: "var(--rose-ink)" }} onClick={() => setView("supprimer")}>
                Supprimer
              </button>
            </div>
          </>
        )}

        {view === "presence" && (
          <>
            <p className="bs-p" style={{ marginTop: 4 }}>Tout le monde est noté présent. Touche seulement ceux qui ne sont pas venus.</p>
            {seance.participants.map((p) => {
              const h = horse(p.horseId);
              const on = presence[p.personId] !== false;
              return (
                <div key={p.personId} className="bs-li">
                  {h ? <HorseFace horse={h} size={34} /> : <span className="bs-ini">{(person(p.personId)?.name ?? "?").slice(0, 2)}</span>}
                  <span className="tx">
                    <b>{person(p.personId)?.name}</b>
                    <span>{h ? `sur ${h.name}` : ""}</span>
                  </span>
                  <div className="bs-seg" style={{ margin: 0, width: 150 }}>
                    <button type="button" aria-pressed={on} onClick={() => setPresence({ ...presence, [p.personId]: true })}>
                      Présent
                    </button>
                    <button type="button" aria-pressed={!on} onClick={() => setPresence({ ...presence, [p.personId]: false })}>
                      Absent
                    </button>
                  </div>
                </div>
              );
            })}
            {absents > 0 && (
              <Toggle on={chargeAbsent} onClick={() => setChargeAbsent(!chargeAbsent)}>
                Faire payer {absents > 1 ? "les absents" : "l’absent"} (pas prévenu à temps)
              </Toggle>
            )}
            <div className="bs-card" style={{ justifyContent: "space-between" }}>
              <span className="k">
                {paying} × {eur(seance.unitPrice)}
              </span>
              <b className="bs-big" style={{ fontSize: 22, color: "var(--vert)" }}>{signed(amount)}</b>
            </div>
            <button type="button" className="bs-btn" style={{ marginTop: 12 }} onClick={validate}>
              Confirmer · {signed(amount)}
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
              <button type="button" className="bs-btn line" onClick={() => setView("annuler")}>
                Elle n’a pas eu lieu
              </button>
              <button type="button" className="bs-btn line" onClick={close}>
                Plus tard
              </button>
            </div>
          </>
        )}

        {view === "annuler" && (
          <>
            <p className="bs-p" style={{ marginTop: 4 }}>Elle ne comptera pas dans ton argent. La raison reste notée sur la séance.</p>
            <div className="bs-chips">
              {REASONS.map((r) => (
                <button key={r} type="button" className="bs-chip" aria-pressed={reason === r} onClick={() => setReason(r)}>
                  {r}
                </button>
              ))}
            </div>
            <div className="bs-field">
              <input placeholder="Ou écris une autre raison" value={REASONS.includes(reason) ? "" : reason} onChange={(e) => setReason(e.target.value)} aria-label="Raison" />
            </div>
            <button type="button" className="bs-btn" style={{ marginTop: 12 }} onClick={cancel}>
              Annuler la séance
            </button>
            <button type="button" className="bs-btn line" onClick={() => setView("fiche")}>
              Retour
            </button>
          </>
        )}

        {view === "modifier" && (
          <>
            <label className="bs-field" style={{ marginTop: 12 }}>
              <span>Date</span>
              <input type="date" value={date} style={{ textAlign: "right" }} onChange={(e) => setDate(e.target.value)} />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label className="bs-field">
                <span>Début</span>
                <input type="time" value={start} style={{ textAlign: "right" }} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className="bs-field">
                <span>Fin</span>
                <input type="time" value={end} style={{ textAlign: "right" }} onChange={(e) => setEnd(e.target.value)} />
              </label>
            </div>
            <div className="bs-field">
              <input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" />
            </div>
            {scopePicker}
            <p className="bs-p" style={{ marginTop: 8 }}>Seul ce que tu changes est modifié. Si tu changes la date, les autres séances choisies bougent du même nombre de jours.</p>
            <button type="button" className="bs-btn" style={{ marginTop: 10 }} disabled={end <= start} onClick={saveEdit}>
              Enregistrer
            </button>
            <button type="button" className="bs-btn line" onClick={() => setView("fiche")}>
              Retour
            </button>
          </>
        )}

        {view === "supprimer" && (
          <>
            {scopePicker}
            <p className="bs-p" style={{ marginTop: 10 }}>L’argent compté pour ces séances est retiré aussi.</p>
            <button type="button" className="bs-btn" style={{ marginTop: 10, background: "var(--rose-ink)" }} onClick={remove}>
              Supprimer
            </button>
            <button type="button" className="bs-btn line" onClick={() => setView("fiche")}>
              Retour
            </button>
          </>
        )}
      </div>
    </>
  );
}
