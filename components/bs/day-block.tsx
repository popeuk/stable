"use client";

import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { esc } from "@/components/bs/ui";
import { Check, Ic, eur, sg } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { useParcours } from "@/components/bs/parcours";
import type { DayItem } from "@/lib/domain/seances";
import { ligneDe, retirer } from "@/components/bs/retirer";
import { localToday } from "@/lib/utils/local-date";

/** Le pictogramme d'un élément de la journée (créneaux, semaine sur ordinateur). */
export function iconOf(it: DayItem): string {
  if (it.type === "seance") return (it.seance?.participants.length ?? 0) > 1 || it.seance?.format === "collectif" ? "user" : "horse";
  if (it.type === "task") return it.task?.kind === "rdv" ? "clock" : it.task?.cost ? "flag" : "list";
  const k = it.care?.[0].kind;
  if (k === "ferrure") return "shoe";
  if (k === "vaccin" || k === "vermifuge" || k === "veto" || k === "dentiste" || k === "osteo" || k === "soin") return "syringe";
  if (k === "concours") return "flag";
  if (k === "document") return "doc";
  if (k === "prestation") return "hay";
  return "horse";
}

/** La classe de l'argent : vert ce qui rentre, rose ce qui sort. */
export const moneyCls = (n?: number) => (!n ? "" : n > 0 ? "in" : "out");

/**
 * Cocher une tâche faite, avec « Annuler » pendant 6 secondes. Les séances
 * et les soins ne se cochent plus : passés, ils comptent tout seuls
 * (lib/domain/compte-auto.ts) et se retirent d'un × s'ils n'ont pas eu lieu.
 */
export function useCheck() {
  const say = useUiStore((s) => s.say);
  const { pass, parcours } = useParcours();
  return useCallback(
    (it: DayItem) => {
      if (it.done || !it.task) return;
      const st = useDataStore.getState();
      const snap = { tasks: st.tasks };
      const undo = () => useDataStore.setState(snap);
      const done = st.taskLists?.find((l) => l.isDone)?.id;
      if (done) st.moveTask(it.task.id, done);
      say(`Tâche faite : <strong>${esc(it.title)}</strong>.`, undo);
      // Le parcours : trois choses faites aujourd'hui passent la barre « ta première journée ».
      const after = useDataStore.getState();
      const today = localToday();
      const n =
        (after.seances ?? []).filter((x) => x.status === "done" && x.date === today).length +
        (after.careEvents ?? []).filter((e) => !e.pending && e.date === today).length;
      if (n >= 3 && parcours.factures) setTimeout(() => pass("journee"), 1200);
    },
    [say, pass, parcours.factures],
  );
}

/** Une séance ou un soin passé : il a compté (ou va compter dans la minute). */
export const aCompte = (it: DayItem) => it.type !== "task" && (it.done || it.late);

/**
 * Une ligne de la journée, dans le carnet : l'heure, ce qui se passe, ce que
 * ça rapporte ou coûte. Une tâche garde sa coche. Une séance ou un soin
 * passé dit « a compté », avec × pour le retirer s'il n'a pas eu lieu (un
 * cours à plusieurs ouvre « qui était là ? »). À placer dans un `.rows`.
 */
export function DayBlock({ it, showTime = true }: { it: DayItem; showTime?: boolean }) {
  const check = useCheck();
  const openSeance = useUiStore((s) => s.openSeance);
  const open = () => {
    if (it.seance) openSeance(it.seance.id);
  };
  const compte = aCompte(it);
  const sub = it.sub || (it.type === "task" ? (it.task?.kind === "rdv" ? "rendez-vous" : "tâche d’équipe") : "");
  const body = (
    <>
      <b>
        {it.task?.kind === "rdv" && (
          <span style={{ display: "inline-flex", verticalAlign: "-3px", marginRight: 4 }}>
            <Ic n="clock" className="cn-ic sm" />
          </span>
        )}
        {it.title}
      </b>
      {(compte || sub) && (
        <small>
          {compte && (
            <span className="cp-ok">
              <Ic n="ck" className="" />a compté
            </span>
          )}
          {compte && sub ? " · " : ""}
          {sub}
        </small>
      )}
    </>
  );
  return (
    <>
      <div className={`row${it.done && it.task ? " done" : ""}${showTime ? "" : " jr-notime"}`}>
        <time>{showTime ? (it.start ?? "·") : ""}</time>
        {it.seance ? (
          <button type="button" className="jr-open" onClick={open} title="Ouvrir la séance">
            {body}
          </button>
        ) : (
          <span>{body}</span>
        )}
        <span className={`amt ${moneyCls(it.money)}`}>{it.money ? sg(it.money) : ""}</span>
        {it.task ? (
          <Check on={it.done} onClick={() => !it.done && check(it)} label={it.done ? `${it.title} : fait` : `C’est fait : ${it.title}`} />
        ) : compte ? (
          <button type="button" className="cp-rm" onClick={() => retirer(ligneDe(it))} aria-label={`Pas eu lieu ? Retirer : ${it.title}`}>
            <Ic n="x" className="" />
          </button>
        ) : (
          <span />
        )}
      </div>
      {it.seance && <PayeSurPlace seance={it.seance} />}
    </>
  );
}

const hhmmNow = (d = new Date()) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const prenom = (n: string) => n.trim().split(/\s+/)[0] || n;

/**
 * Payé sur place : sous une séance passée, une ligne par cavalier qui paie à
 * la séance (réglé sur sa fiche client), avec « Payé sur place » d'un
 * toucher. Le paiement est lié à la séance : sur sa fiche, la ligne dit
 * « payé sur place ». Styles : app/carnet/client.css.
 */
function PayeSurPlace({ seance: s }: { seance: NonNullable<DayItem["seance"]> }) {
  const people = useDataStore((st) => st.people);
  const paid = useDataStore(useShallow((st) => (st.payments ?? []).filter((p) => p.seanceId === s.id).map((p) => p.payer)));
  const say = useUiStore((st) => st.say);
  const today = localToday();
  const passee = s.status !== "cancelled" && (s.date < today || (s.date === today && s.end <= hhmmNow()));
  if (!passee || s.unitPrice <= 0) return null;
  const qui = s.participants
    .filter((p) => p.present !== false)
    .map((p) => (people ?? []).find((x) => x.id === p.personId))
    .filter((p): p is NonNullable<typeof p> => !!p && !!p.paieALaSeance);
  if (!qui.length) return null;
  const payer = (name: string) => {
    const id = useDataStore.getState().addPayment(name, s.date.slice(0, 7), s.unitPrice, s.id);
    say(`${esc(prenom(name))} t’a payé <strong>${eur(s.unitPrice)}</strong>.`, () => useDataStore.getState().removePayment(id));
  };
  return (
    <>
      {qui.map((p) => (
        <div key={p.id} className="cl-who">
          <span>{prenom(p.name)}</span>
          <span className="in">{sg(s.unitPrice)}</span>
          {paid.includes(p.name) ? (
            <span className="cl-paid">
              <Ic n="ck" className="" />
              payé sur place
            </span>
          ) : (
            <button type="button" className="btn line" onClick={() => payer(p.name)}>
              Payé sur place
            </button>
          )}
        </div>
      ))}
    </>
  );
}
