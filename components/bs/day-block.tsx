"use client";

import { useCallback } from "react";
import { esc, signed } from "@/components/bs/ui";
import { Check, Ic, sg } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { useParcours } from "@/components/bs/parcours";
import type { DayItem } from "@/lib/domain/seances";
import { localToday } from "@/lib/utils/local-date";

/** Le pictogramme d'un élément de la journée (créneaux, semaine sur ordinateur). */
export function iconOf(it: DayItem): string {
  if (it.type === "seance") return (it.seance?.participants.length ?? 0) > 1 ? "user" : "horse";
  if (it.type === "task") return it.task?.cost ? "flag" : "list";
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

/** « en retard de 3 j » pour un soin passé, « à confirmer » pour le reste. */
export function lateLabel(it: DayItem, today: string): string {
  if (!it.late || it.done) return "";
  const d = it.seance?.date ?? it.care?.[0].date;
  if (it.care && d && d < today) {
    const n = Math.round((Date.parse(today + "T12:00:00") - Date.parse(d + "T12:00:00")) / 864e5);
    return `en retard de ${n} j`;
  }
  return "à confirmer";
}

/**
 * Valider un élément du planning. Une séance à plusieurs cavaliers ouvre la
 * feuille de présence ; les autres se valident d'une coche, avec « Annuler »
 * pendant 6 secondes.
 */
export function useCheck() {
  const say = useUiStore((s) => s.say);
  const openSeance = useUiStore((s) => s.openSeance);
  const { pass, parcours } = useParcours();
  return useCallback(
    (it: DayItem) => {
      const st = useDataStore.getState();
      const snap = { seances: st.seances, careEvents: st.careEvents, directExpenses: st.directExpenses, revenues: st.revenues, tasks: st.tasks, sharedExpenses: st.sharedExpenses };
      const undo = () => useDataStore.setState(snap);
      if (it.done) return;
      if (it.seance) {
        if (it.seance.participants.length > 1) return openSeance(it.seance.id, "presence");
        st.validateSeance(it.seance.id, {});
        say(`${esc(it.title)} : c’est fait, <strong>${signed(it.money ?? 0)}</strong> sur le ticket.`, undo);
      } else if (it.care) {
        st.confirmSession(it.care.map((e) => e.id), it.care.map((e) => e.horseId), it.care[0].date < localToday() ? it.care[0].date : localToday());
        say(`${esc(it.title)} : c’est fait${it.money ? `, <strong>${signed(it.money)}</strong> sur le ticket` : ""}.`, undo);
      } else if (it.task) {
        const done = st.taskLists?.find((l) => l.isDone)?.id;
        if (done) st.moveTask(it.task.id, done);
        say(`Tâche faite : <strong>${esc(it.title)}</strong>.`, undo);
      }
      // Le parcours : trois validations aujourd'hui passent la barre « ta première journée ».
      const after = useDataStore.getState();
      const today = localToday();
      const n =
        (after.seances ?? []).filter((x) => x.status === "done" && x.date === today).length +
        (after.careEvents ?? []).filter((e) => !e.pending && e.date === today).length;
      if (n >= 3 && parcours.factures) setTimeout(() => pass("journee"), 1200);
    },
    [say, openSeance, pass, parcours.factures],
  );
}

/**
 * Une ligne de la journée, dans le carnet : l'heure, ce qui se passe, ce que
 * ça rapporte ou coûte, et la coche. Une séance à plusieurs a une coche en
 * pointillé : elle ouvre « qui était là ? ». À placer dans un `.rows`.
 */
export function DayBlock({ it, showTime = true }: { it: DayItem; showTime?: boolean }) {
  const check = useCheck();
  const openSeance = useUiStore((s) => s.openSeance);
  const open = () => {
    if (it.seance) openSeance(it.seance.id);
  };
  const late = lateLabel(it, localToday());
  const sub = it.sub || (it.type === "task" ? "tâche d’équipe" : "");
  const body = (
    <>
      <b>{it.title}</b>
      {(late || sub) && (
        <small>
          {late && <b className="jr-late">{late}</b>}
          {late && sub ? " · " : ""}
          {sub}
        </small>
      )}
    </>
  );
  const multi = !!it.seance && it.seance.participants.length > 1 && !it.done;
  return (
    <div className={`row${it.done ? " done" : ""}${showTime ? "" : " jr-notime"}`}>
      <time>{showTime ? (it.start ?? "·") : ""}</time>
      {it.seance ? (
        <button type="button" className="jr-open" onClick={open} title="Ouvrir la séance">
          {body}
        </button>
      ) : (
        <span>{body}</span>
      )}
      <span className={`amt ${moneyCls(it.money)}`}>{it.money ? sg(it.money) : ""}</span>
      {multi ? (
        <button type="button" className="jr-ckm" onClick={() => check(it)} aria-label={`Dire qui était là : ${it.title}`}>
          <Ic n="ck" className="" />
        </button>
      ) : (
        <Check on={it.done} onClick={() => (it.done ? open() : check(it))} label={it.done ? `${it.title} : fait` : `C’est fait : ${it.title}`} />
      )}
    </div>
  );
}
