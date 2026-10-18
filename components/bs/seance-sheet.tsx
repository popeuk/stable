"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFeuille } from "@/components/bs/feuille";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { esc } from "@/components/bs/ui";
import { Chips, Face, Ic, Money, Seg, eurc, ini } from "@/components/carnet/ui";
import { retirer } from "@/components/bs/retirer";
import { localToday } from "@/lib/utils/local-date";
import { isEmptySeance, seanceAmount, seancePassee } from "@/lib/domain/seances";
import { HorseChips, InField } from "@/components/bs/seance-form";
import { habitues } from "@/lib/domain/ajouter";
import { norm } from "@/lib/domain/interpret";
import { nomRetenu } from "@/lib/domain/proprio";
import type { Seance } from "@/lib/domain/types";

/**
 * La fiche d'une séance. À venir : inscrire, l'annuler avec un motif, la
 * modifier ou la supprimer avec une portée (cette séance, les suivantes,
 * toute la série). Commencée ou passée : l'appel. Chaque inscrit a sa case,
 * cochée par défaut ; on décoche les absents et « Valider les présents »
 * compte la séance (une passée a déjà compté avec tout le monde). Ou
 * « Elle n’a pas eu lieu ».
 * Passée sans personne d'inscrit : elle ne compte rien (0 €) et invite à
 * ajouter qui est venu ; chaque nom ajouté après coup compte tout de suite.
 * Chaque geste propose « Annuler » pendant 6 secondes. Feuille du carnet, rendue dans le body
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

const hhmm = (d = new Date()) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;


function Inner({ seance }: { seance: Seance }) {
  const view0 = useUiStore((s) => s.seanceView);
  const close = useUiStore((s) => s.closeSeance);
  const say = useUiStore((s) => s.say);
  const data = useDataStore();
  const st = useDataStore.getState;
  const gerant = useSettingsStore((s) => s.gerant);
  const [view, setView] = useState<"fiche" | "presence" | "annuler" | "modifier" | "supprimer">(view0);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(seance.date);
  const [start, setStart] = useState(seance.start);
  const [end, setEnd] = useState(seance.end);
  const [notes, setNotes] = useState(seance.notes ?? "");
  const [scope, setScope] = useState<"one" | "following" | "all">("one");
  // L'appel : seuls les changements sont gardés ici, le reste vient de la séance.
  const [appelLocal, setAppelLocal] = useState<Record<string, boolean>>({});

  const ref = useFeuille(close, { verrou: true });
  // Changer de vue (présence, annuler, modifier) remplace les boutons : le focus reste dans la feuille.
  useEffect(() => {
    const el = ref.current;
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
  }, [view, ref]);

  const person = (pid: string) => data.people?.find((p) => p.id === pid);
  const horse = (hid?: string) => data.horses.find((h) => h.id === hid);
  const series = seance.seriesId ? (data.seances ?? []).filter((x) => x.seriesId === seance.seriesId) : [];
  const following = series.filter((x) => x.date >= seance.date).length;
  const vide = isEmptySeance(seance);
  const dateLabel = new Date(seance.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const over = `${dateLabel.charAt(0).toUpperCase()}${dateLabel.slice(1)} · ${seance.start} à ${seance.end}${seance.lieu ? ` · ${seance.lieu}` : ""}`;
  const collectif = seance.format === "collectif";
  const today = localToday();
  const now = hhmm();
  const passee = seancePassee(seance, today, now);
  // Le cours a commencé : on peut faire l'appel sans attendre la fin.
  const commencee = passee || (seance.status === "planned" && seance.date === today && seance.start <= now);
  const appel = commencee && seance.status !== "cancelled" && seance.participants.length > 0;
  const plusieurs = seance.participants.length > 1;
  const estLa = (p: Seance["participants"][number]) => appelLocal[p.personId] ?? p.present !== false;
  const nLa = seance.participants.filter(estLa).length;
  const aChange = seance.status !== "done" || seance.participants.some((p) => estLa(p) !== (p.present !== false));
  // Ce que l'appel ferait compter : les présents, plus les absents si la séance les facture. Un forfait a déjà payé.
  const montantAppel = Math.round(seance.unitPrice * seance.participants.filter((p) => !p.forfait && (estLa(p) || seance.chargeAbsent)).length * 100) / 100;

  function cancel() {
    const snap = snapshot();
    st().cancelSeance(seance.id, reason);
    say(`Séance annulée : ${esc(seance.title)}${reason ? ` (${esc(reason.toLowerCase())})` : ""}. Rien n’est compté.`, () => useDataStore.setState(snap));
    close();
  }
  /** Elle n'a pas eu lieu : toute la séance est retirée, sa recette aussi. */
  function pasEuLieu() {
    if (!plusieurs) {
      retirer({ seanceId: seance.id, label: seance.title });
    } else {
      const snap = snapshot();
      st().cancelSeance(seance.id, "N’a pas eu lieu");
      say(`${esc(seance.title)} : retiré.`, () => useDataStore.setState(snap));
    }
    close();
  }
  /** Valider les présents : la séance compte pour ceux qui sont cochés. */
  function validerAppel() {
    const snap = snapshot();
    const presence = Object.fromEntries(seance.participants.map((p) => [p.personId, estLa(p)]));
    st().validateSeance(seance.id, presence, seance.chargeAbsent);
    const total = seance.participants.length;
    say(`${esc(seance.title)} : ${nLa === total ? (total > 1 ? "tout le monde était là" : "présent") : `${nLa} sur ${total} présent${nLa > 1 ? "s" : ""}`}, c’est compté.`, () => useDataStore.setState(snap));
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
    seance.status === "planned" && !passee && (view === "annuler" || view === "modifier") ? (
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
  if (view === "fiche" || view === "presence") {
    const rows = seance.participants.length ? seance.participants : seance.horseIds.map((h) => ({ personId: "", horseId: h, present: undefined as boolean | undefined }));
    // Passée sans personne : rien n'a compté, on invite à dire qui est venu.
    const etat = seance.status === "cancelled" ? `Retirée${seance.cancelReason ? ` · ${seance.cancelReason}` : ""}` : passee ? (vide ? "Personne d’inscrit" : "A compté") : "Prévue";
    // Un seul mot pour le prix : par cavalier (un participant est un cavalier) ; par cheval seulement pour un travail sans cavalier.
    const parCheval = !seance.participants.length && seance.horseIds.length > 0;
    body = (
      <>
        <div className="jr-pills">
          <span className={`pill${!passee && seance.status === "planned" ? " ink" : ""}`}>{etat}</span>
          <span className="pill">{seance.unitPrice > 0 ? `${eurc(seance.unitPrice)} ${parCheval ? "par cheval" : "par cavalier"}` : "Pas de prix pour l’instant"}</span>
          {seance.seriesId && <span className="pill">revient, {series.length} séances en tout</span>}
        </div>
        <p className="k jr-k">
          {appel ? `Qui ${passee ? "était" : "est"} là · ${nLa} sur ${seance.participants.length}` : passee && vide ? "Qui était là" : seance.participants.length || vide ? "Cavaliers" : "Chevaux"}
          {!commencee && seance.places ? ` · ${seance.participants.length} sur ${seance.places}` : ""}
        </p>
        {appel && (
          <p className="note">
            {seance.status === "done" ? "Tout le monde est compté. Décoche ceux qui ne sont pas venus, puis valide." : "Tout le monde est coché. Décoche ceux qui ne sont pas là, puis valide."}
          </p>
        )}
        {rows.map((p, i) => {
          const h = horse(p.horseId);
          const who = person(p.personId)?.name;
          const sur = h && p.personId ? `sur ${h.name}` : "";
          if (appel && who) {
            const la = estLa(p as Seance["participants"][number]);
            return (
              <button
                key={p.personId}
                type="button"
                className={`li jr-appel${la ? "" : " off"}`}
                aria-pressed={la}
                onClick={() => setAppelLocal((m) => ({ ...m, [p.personId]: !la }))}
              >
                <span className="ini">{ini(who)}</span>
                <span>
                  <b>{who}</b>
                  <small>{[sur, la ? "présent" : "absent"].filter(Boolean).join(" · ")}</small>
                </span>
                <span className={`ck${la ? " on" : ""}`} aria-hidden="true">
                  <Ic n="ck" className="" />
                </span>
              </button>
            );
          }
          return (
            <div key={p.personId || p.horseId || i} className="li">
              {who ? <span className="ini">{ini(who)}</span> : <Face horse={h} />}
              <span>
                <b>{who ?? h?.name}</b>
                {sur && <small>{sur}</small>}
              </span>
              {h && who ? <Face horse={h} className="jr-sm" /> : <span />}
            </div>
          );
        })}
        {appel &&
          (aChange ? (
            <button type="button" className="btn full jr-btn-top" onClick={validerAppel}>
              <Ic n="ck" className="" />
              Valider les présents · {nLa} sur {seance.participants.length}
            </button>
          ) : (
            <p className="jr-valide">
              <Ic n="ck" className="" />
              Présents validés : {nLa} sur {seance.participants.length}
            </p>
          ))}
        {vide &&
          (passee && seance.status !== "cancelled" ? (
            <p className="note">Personne d’inscrit, donc rien à compter. Ajoute qui est venu, et la séance comptera pour eux.</p>
          ) : (
            <p className="note">
              Personne d’inscrit pour l’instant{collectif && seance.places ? ` · ${seance.places} place${seance.places > 1 ? "s" : ""} libre${seance.places > 1 ? "s" : ""}` : ""}. Elle ne rapporte rien tant que personne n’y est inscrit.
            </p>
          ))}
        {seance.status !== "cancelled" && <Inscrire seance={seance} passee={passee} />}
        {seance.notes && <p className="note">{seance.notes}</p>}
        {seance.updatedBy && <p className="note" style={{ fontSize: 12 }}>Modifiée par {seance.updatedBy}</p>}
        <div className="card jr-tot">
          <span className="k">{appel && aChange ? "Comptera" : passee ? (vide ? "Pour l’instant" : "A rapporté") : "Rapportera"}</span>
          <b className="mid">
            <Money exact v={seance.status === "cancelled" ? 0 : appel ? montantAppel : seanceAmount(seance)} />
          </b>
        </div>
        {passee && !vide && (
          <button type="button" className="btn line full jr-btn-top" onClick={pasEuLieu}>
            Elle n’a pas eu lieu
          </button>
        )}
        {seance.status === "cancelled" && (
          <button
            type="button"
            className="btn line full jr-btn-top"
            onClick={() => {
              const snap = snapshot();
              st().unvalidateSeance(seance.id);
              say("La séance revient au planning.", () => useDataStore.setState(snap));
              close();
            }}
          >
            Remettre la séance au planning
          </button>
        )}
        <div className={seance.status === "planned" && !passee ? "jr-3" : "jr-2"}>
          {seance.status === "planned" && !passee && (
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
  } else if (view === "annuler") {
    body = (
      <>
        {tabs}
        <p className="note">Elle ne comptera pas dans ton argent. La raison reste notée.</p>
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
        <p className="note">Seul ce que tu changes bouge. Si tu changes la date, les autres séances choisies se décalent d’autant de jours.</p>
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
        <p className="note">L’argent de ces séances est retiré aussi.</p>
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
      <div className="sheet" role="dialog" aria-modal="true" aria-label={seance.title} ref={ref} tabIndex={-1}>
        <div className="grab" />
        <div className="shd">
          <span className="jr-over">{over}</span>
          <button type="button" className="x" onClick={close} aria-label="Fermer">
            <Ic n="x" className="" />
          </button>
        </div>
        <div className="pad">
          <h2 className="jr-sh">{view === "presence" && appel ? `${seance.title} · qui ${passee ? "était" : "est"} là ?` : seance.title}</h2>
          {body}
        </div>
      </div>
    </div>
  );
}

/**
 * Inscrire : les habitués de ce cours d'abord (ceux des séances passées du
 * même cours, au même créneau), un toucher et c'est fait. Puis « Tape un
 * nom » qui filtre à chaque lettre parmi les cavaliers et les propriétaires ;
 * un nom inconnu devient un nouveau cavalier. Les places et le montant prévu
 * suivent. Les chevaux s'ajoutent en dessous.
 */
function Inscrire({ seance, passee }: { seance: Seance; passee: boolean }) {
  const data = useDataStore();
  const say = useUiStore((s) => s.say);
  const gerant = useSettingsStore((s) => s.gerant);
  const [typed, setTyped] = useState("");
  const horses = data.horses.filter((h) => !h.isArchived);
  const people = (data.people ?? []).filter((p) => p.active);
  const inscrits = new Set(seance.participants.map((p) => p.personId));
  const max = seance.format === "particulier" ? 1 : (seance.places ?? Infinity);
  const plein = seance.participants.length >= max;
  const habit = habitues(data.seances ?? [], seance)
    .map((pid) => people.find((p) => p.id === pid))
    .filter((p): p is NonNullable<typeof p> => !!p);
  const q = norm(typed.trim());
  const sugg = q ? people.filter((p) => !inscrits.has(p.id) && norm(p.name).includes(q)).slice(0, 6) : [];
  const exact = people.some((p) => norm(p.name) === q);

  function inscrire(nom: string) {
    // Le client connu sous ce nom (casse et accents confondus), sinon un nouveau cavalier.
    const v = nomRetenu(
      (data.people ?? []).map((p) => p.name),
      nom,
    ) ?? "";
    if (!v || plein || v.includes(",")) return;
    const st = useDataStore.getState();
    const snap = { seances: st.seances, people: st.people, revenues: st.revenues };
    const owner = horses.find((h) => h.ownerName === v);
    const personId = st.ensurePerson(v, owner ? "proprietaire" : "cavalier");
    setTyped("");
    if (inscrits.has(personId)) return;
    const horseId = owner?.id ?? (seance.horseIds.length ? seance.horseIds[seance.participants.length % seance.horseIds.length] : undefined);
    const participants = [...seance.participants, { personId, horseId }];
    st.updateSeance(seance.id, { participants, updatedBy: gerant }, "one");
    if (passee) recompter(participants);
    say(passee ? `<strong>${esc(v)}</strong> ajouté à ${esc(seance.title)}, c’est compté.` : `<strong>${esc(v)}</strong> inscrit à ${esc(seance.title)}.`, () => useDataStore.setState(snap));
  }
  /** Ajouté après coup : la séance compte tout de suite, au prix figé, les absents restent absents. */
  function recompter(participants: Seance["participants"]) {
    const presence = Object.fromEntries(participants.map((p) => [p.personId, p.present !== false]));
    useDataStore.getState().validateSeance(seance.id, presence, seance.chargeAbsent);
  }

  return (
    <div className="field" style={{ marginTop: 14 }}>
      <span>{plein ? "C’est complet" : passee ? (seance.participants.length ? "Quelqu’un d’autre est venu ?" : "Ajoute qui est venu") : "Inscrire"}</span>
      {!plein && (
        <>
          {habit.length > 0 && (
            <div className="chips">
              {habit.map((p) => (
                <button key={p.id} type="button" className="chip" onClick={() => inscrire(p.name)}>
                  + {p.name}
                </button>
              ))}
            </div>
          )}
          <InField>
            <input value={typed} placeholder="Tape un nom" onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), inscrire(typed))} aria-label="Tape un nom de cavalier ou de propriétaire" autoComplete="off" enterKeyHint="done" />
          </InField>
          {(sugg.length > 0 || (q && !exact)) && (
            <div className="chips">
              {sugg.map((p) => (
                <button key={p.id} type="button" className="chip" onClick={() => inscrire(p.name)}>
                  + {p.name}
                </button>
              ))}
              {q && !exact && !typed.includes(",") && (
                <button type="button" className="chip" onClick={() => inscrire(typed)}>
                  + {typed.trim()}, nouveau cavalier
                </button>
              )}
            </div>
          )}
        </>
      )}
      {horses.length > 0 && <span className="jr-sub">Les chevaux de la séance</span>}
      {horses.length > 0 && (
        <HorseChips
          horses={horses}
          value={seance.horseIds}
          onChange={(ids) => {
            const st = useDataStore.getState();
            const snap = { seances: st.seances, revenues: st.revenues };
            st.updateSeance(seance.id, { horseIds: ids, updatedBy: gerant }, "one");
            if (passee) {
              if (seance.participants.length || ids.length) recompter(seance.participants);
              else st.unvalidateSeance(seance.id);
            }
            say(ids.length > seance.horseIds.length ? "Cheval ajouté à la séance." : "Cheval retiré de la séance.", () => useDataStore.setState(snap));
          }}
        />
      )}
    </div>
  );
}
