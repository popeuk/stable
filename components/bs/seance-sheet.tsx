"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { eur, esc, signed } from "@/components/bs/ui";
import { Chips, Face, Ic, Money, Seg, Switch, ini } from "@/components/carnet/ui";
import { MAX_PLACES, isEmptySeance, seanceAmount } from "@/lib/domain/seances";
import { HorseChips, InField } from "@/components/bs/seance-form";
import type { Seance } from "@/lib/domain/types";

/**
 * La fiche d'une séance : la valider (feuille de présence), l'annuler avec
 * un motif, la modifier ou la supprimer avec une portée (cette séance, les
 * suivantes, toute la série). Toute validation ou annulation propose
 * « Annuler » pendant 6 secondes. Feuille du carnet, rendue dans le body
 * (un parent flouté coupe les panneaux fixes sur iPhone).
 */
const REASONS = ["Météo", "Cheval boiteux", "Cavalier absent", "Imprévu"];

export function SeanceSheet() {
  const id = useUiStore((s) => s.seanceId);
  const seance = useDataStore((s) => (id ? s.seances?.find((x) => x.id === id) : undefined));
  if (!id || !seance || typeof document === "undefined") return null;
  return createPortal(
    <div className="carnet carnet-portal">
      <Inner key={id} seance={seance} />
    </div>,
    document.body,
  );
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
  const paying = seance.participants.length ? seance.participants.length - (chargeAbsent ? 0 : absents) : seance.horseIds.length;
  const vide = isEmptySeance(seance);
  const amount = seance.unitPrice * paying;
  const dateLabel = new Date(seance.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const over = `${dateLabel.charAt(0).toUpperCase()}${dateLabel.slice(1)} · ${seance.start} à ${seance.end}${seance.lieu ? ` · ${seance.lieu}` : ""}`;
  const collectif = seance.format === "collectif";

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

  const scopePicker = seance.seriesId ? (
    <>
      <p className="k jr-k">Pour quelles séances ?</p>
      {(
        [
          ["one", "Cette séance seulement", dateLabel],
          ["following", "Celle-ci et les suivantes", following > 1 ? `${following} séances` : "1 séance, c’est la dernière de la série"],
          ["all", "Toutes les séances de la série", `${series.length} séances, déjà faites comprises`],
        ] as const
      ).map(([k, t, sub]) => (
        <button key={k} type="button" className="li jr-scope" onClick={() => setScope(k)} aria-pressed={scope === k}>
          <span className={`ck${scope === k ? " on" : ""}`} aria-hidden="true">
            <Ic n="ck" className="" />
          </span>
          <span>
            <b>{t}</b>
            <small>{sub}</small>
          </span>
          <span />
        </button>
      ))}
    </>
  ) : null;

  // Annuler et Modifier se répondent en onglets, comme sur la maquette.
  const tabs =
    seance.status === "planned" && (view === "annuler" || view === "modifier") ? (
      <div style={{ marginTop: 12 }}>
        <Seg
          value={view}
          onChange={(v) => setView(v)}
          label="Annuler ou modifier"
          options={[
            ["annuler", "Annuler"],
            ["modifier", "Modifier"],
          ]}
        />
      </div>
    ) : null;

  let body: ReactNode = null;
  if (view === "fiche") {
    const rows = seance.participants.length ? seance.participants : seance.horseIds.map((h) => ({ personId: "", horseId: h, present: undefined as boolean | undefined }));
    body = (
      <>
        <div className="jr-pills">
          <span className={`pill${seance.status === "planned" ? " ink" : ""}`}>
            {seance.status === "done" ? "Faite" : seance.status === "cancelled" ? `Annulée${seance.cancelReason ? ` · ${seance.cancelReason}` : ""}` : "Prévue"}
          </span>
          <span className="pill">
            {eur(seance.unitPrice)} {seance.participants.length ? "par cavalier" : "par cheval"}
          </span>
          {seance.seriesId && <span className="pill">revient, {series.length} séances en tout</span>}
        </div>
        <p className="k jr-k">
          {seance.participants.length ? "Cavaliers" : "Chevaux"}
          {collectif ? ` · ${seance.participants.length} sur ${seance.places ?? MAX_PLACES}` : ""}
        </p>
        {rows.map((p, i) => {
          const h = horse(p.horseId);
          const who = person(p.personId)?.name;
          return (
            <div key={p.personId || p.horseId || i} className="li">
              {who ? <span className="ini">{ini(who)}</span> : <Face horse={h} />}
              <span>
                <b>{who ?? h?.name}</b>
                <small>{h && p.personId ? `sur ${h.name}` : ""}</small>
              </span>
              {seance.status === "done" && p.personId ? (
                <span className="pill">{p.present === false ? "absent" : "présent"}</span>
              ) : h && who ? (
                <Face horse={h} className="jr-sm" />
              ) : (
                <span />
              )}
            </div>
          );
        })}
        {vide && <p className="note">Personne d’inscrit pour l’instant{collectif ? ` · ${seance.places ?? MAX_PLACES} places libres` : ""}. Elle ne rapporte rien tant que personne n’y est inscrit.</p>}
        {seance.status === "planned" && <Inscrire seance={seance} />}
        {seance.notes && <p className="note">{seance.notes}</p>}
        {seance.updatedBy && <p className="note" style={{ fontSize: 12 }}>Modifiée par {seance.updatedBy}</p>}
        <div className="card jr-tot">
          <span className="k">{seance.status === "done" ? "A rapporté" : "Rapportera"}</span>
          <b className="mid">
            <Money v={seanceAmount(seance)} />
          </b>
        </div>
        {seance.status === "planned" && !vide && (
          <button type="button" className="btn full jr-btn-top" onClick={() => (seance.participants.length > 1 ? setView("presence") : validate())}>
            <Ic n="ck" className="" />
            {seance.participants.length > 1 ? "Confirmer et dire qui était là" : `Confirmer que c’est fait · ${signed(amount)}`}
          </button>
        )}
        {seance.status !== "planned" && (
          <button
            type="button"
            className="btn line full jr-btn-top"
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
        <div className={seance.status === "planned" ? "jr-3" : "jr-2"}>
          {seance.status === "planned" && (
            <button type="button" className="btn line" onClick={() => setView("annuler")}>
              Annulée
            </button>
          )}
          <button type="button" className="btn line" onClick={() => setView("modifier")}>
            Modifier
          </button>
          <button type="button" className="btn line" onClick={() => setView("supprimer")}>
            <Ic n="trash" className="" />
            Supprimer
          </button>
        </div>
      </>
    );
  } else if (view === "presence") {
    body = (
      <>
        <p className="note">Tout le monde est noté présent. Touche seulement ceux qui ne sont pas venus.</p>
        {seance.participants.map((p) => {
          const h = horse(p.horseId);
          const name = person(p.personId)?.name ?? "?";
          const on = presence[p.personId] !== false;
          return (
            <div key={p.personId} className="li">
              <span className="ini">{ini(name)}</span>
              <span>
                <b>{name}</b>
                <small>{h ? `sur ${h.name}` : ""}</small>
              </span>
              <div className="jr-pa">
                <Seg
                  value={on ? "p" : "a"}
                  onChange={(v) => setPresence({ ...presence, [p.personId]: v === "p" })}
                  label={`Présence de ${name}`}
                  options={[
                    ["p", "Présent"],
                    ["a", "Absent"],
                  ]}
                />
              </div>
            </div>
          );
        })}
        {absents > 0 && (
          <Switch on={chargeAbsent} onClick={() => setChargeAbsent(!chargeAbsent)}>
            Faire payer {absents > 1 ? "les absents" : "l’absent"} (pas prévenu à temps)
          </Switch>
        )}
        <div className="card jr-tot">
          <span className="k">
            {paying} × {eur(seance.unitPrice)} = {eur(amount)}
          </span>
          <b className="mid">
            <Money v={amount} />
          </b>
        </div>
        <button type="button" className="btn full jr-btn-top" onClick={validate}>
          Confirmer · {signed(amount)}
        </button>
        <div className="jr-2">
          <button type="button" className="btn line" onClick={() => setView("annuler")}>
            Elle n’a pas eu lieu
          </button>
          <button type="button" className="btn line" onClick={close}>
            Plus tard
          </button>
        </div>
      </>
    );
  } else if (view === "annuler") {
    body = (
      <>
        {tabs}
        <p className="note">Elle ne comptera pas dans ton argent. La raison reste notée sur la séance.</p>
        <div style={{ marginTop: 12 }}>
          <Chips value={REASONS.includes(reason) ? reason : ""} onChange={(r) => setReason(r)} options={REASONS.map((r) => [r, r] as [string, string])} />
        </div>
        <label className="field" style={{ marginTop: 12 }}>
          <input className="input" placeholder="Ou écris une autre raison" value={REASONS.includes(reason) ? "" : reason} onChange={(e) => setReason(e.target.value)} aria-label="Raison" />
        </label>
        <button type="button" className="btn full" style={{ marginTop: 14 }} onClick={cancel}>
          Annuler la séance
        </button>
        <button type="button" className="btn ghost full" onClick={() => setView("fiche")}>
          Retour
        </button>
      </>
    );
  } else if (view === "modifier") {
    body = (
      <>
        {tabs}
        <div className="form jr-form">
          <label className="field">
            <span>Date</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="jr-2" style={{ marginTop: 0 }}>
            <label className="field">
              <span>Début</span>
              <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="field">
              <span>Fin</span>
              <input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>Notes</span>
            <input className="input" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        {scopePicker}
        <p className="note">Seul ce que tu changes est modifié. Si tu changes la date, les autres séances choisies bougent du même nombre de jours.</p>
        <button type="button" className="btn full jr-btn-top" disabled={end <= start} onClick={saveEdit}>
          Enregistrer
        </button>
        <button type="button" className="btn ghost full" onClick={() => setView("fiche")}>
          Retour
        </button>
      </>
    );
  } else {
    body = (
      <>
        {scopePicker}
        <p className="note">L’argent compté pour ces séances est retiré aussi.</p>
        <button type="button" className="btn danger full jr-btn-top" onClick={remove}>
          <Ic n="trash" className="" />
          Supprimer
        </button>
        <button type="button" className="btn ghost full" onClick={() => setView("fiche")}>
          Retour
        </button>
      </>
    );
  }

  return (
    <div className="sheet-wrap open">
      <div className="scrim" onClick={close} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={seance.title}>
        <div className="grab" />
        <div className="shd">
          <span className="jr-over">{over}</span>
          <button type="button" className="x" onClick={close} aria-label="Fermer">
            <Ic n="x" className="" />
          </button>
        </div>
        <div className="pad">
          <h3 className="jr-sh">{view === "presence" ? `${seance.title} · qui était là ?` : seance.title}</h3>
          {body}
        </div>
      </div>
    </div>
  );
}

/**
 * Inscrire quelqu'un après coup : un cavalier (son nom, ou un client déjà
 * connu) ou un cheval. Une séance posée vide se remplit ainsi ; elle se met
 * à rapporter dès le premier inscrit.
 */
function Inscrire({ seance }: { seance: Seance }) {
  const data = useDataStore();
  const say = useUiStore((s) => s.say);
  const gerant = useSettingsStore((s) => s.gerant);
  const [typed, setTyped] = useState("");
  const horses = data.horses.filter((h) => !h.isArchived);
  const people = (data.people ?? []).filter((p) => p.active);
  const inscrits = new Set(seance.participants.map((p) => p.personId));
  const max = seance.format === "collectif" ? (seance.places ?? MAX_PLACES) : seance.format === "particulier" ? 1 : MAX_PLACES;
  const plein = seance.participants.length >= max;
  const q = typed.trim().toLowerCase();
  const sugg = q ? people.filter((p) => !inscrits.has(p.id) && p.name.toLowerCase().includes(q)).slice(0, 6) : [];

  function inscrire(nom: string) {
    const v = nom.trim();
    if (!v || plein || v.includes(",")) return;
    const st = useDataStore.getState();
    const snap = { seances: st.seances, people: st.people };
    const owner = horses.find((h) => h.ownerName === v);
    const personId = st.ensurePerson(v, owner ? "proprietaire" : "cavalier");
    if (inscrits.has(personId)) return setTyped("");
    const horseId = owner?.id ?? (seance.horseIds.length ? seance.horseIds[seance.participants.length % seance.horseIds.length] : undefined);
    st.updateSeance(seance.id, { participants: [...seance.participants, { personId, horseId }], updatedBy: gerant }, "one");
    setTyped("");
    say(`<strong>${esc(v)}</strong> inscrit à ${esc(seance.title)}.`, () => useDataStore.setState(snap));
  }

  return (
    <div className="field" style={{ marginTop: 14 }}>
      <span>{plein ? "C’est complet" : "Inscrire quelqu’un"}</span>
      {!plein && (
        <>
          <InField>
            <input value={typed} placeholder="Nom du cavalier ou du propriétaire" onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), inscrire(typed))} aria-label="Inscrire un cavalier" />
            {typed.trim() && (
              <button type="button" className="lnk" onClick={() => inscrire(typed)}>
                Inscrire
              </button>
            )}
          </InField>
          {sugg.length > 0 && (
            <Chips value="" onChange={(id) => inscrire(people.find((p) => p.id === id)?.name ?? "")} options={sugg.map((p) => [p.id, `+ ${p.name}`] as [string, string])} />
          )}
        </>
      )}
      {horses.length > 0 && (
        <HorseChips
          horses={horses}
          value={seance.horseIds}
          onChange={(ids) => {
            const st = useDataStore.getState();
            const snap = { seances: st.seances };
            st.updateSeance(seance.id, { horseIds: ids, updatedBy: gerant }, "one");
            say(ids.length > seance.horseIds.length ? "Cheval ajouté à la séance." : "Cheval retiré de la séance.", () => useDataStore.setState(snap));
          }}
        />
      )}
    </div>
  );
}
