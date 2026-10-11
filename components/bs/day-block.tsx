"use client";

import { useCallback } from "react";
import { Picto, CARE_PICTO } from "@/components/bs/picto";
import { esc, signed } from "@/components/bs/ui";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { useParcours } from "@/components/bs/parcours";
import type { DayItem } from "@/lib/domain/seances";
import { localToday } from "@/lib/utils/local-date";

const TONE_COLOR = { g: "var(--vert)", r: "var(--rose-pic)", o: "#8C6A35", n: "var(--ink-2)" } as const;

function pictoOf(it: DayItem) {
  if (it.type === "seance") return "cours";
  if (it.type === "task") return it.task?.cost ? "foin" : "board";
  return it.care ? CARE_PICTO[it.care[0].kind] : "cal";
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
        say(`${esc(it.title)} validée : <strong>${signed(it.money ?? 0)}</strong> sur le ticket.`, undo);
      } else if (it.care) {
        st.confirmSession(it.care.map((e) => e.id), it.care.map((e) => e.horseId), it.care[0].date < localToday() ? it.care[0].date : localToday());
        say(`${esc(it.title)} : fait${it.money ? `, <strong>${signed(it.money)}</strong> sur le ticket` : ""}.`, undo);
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

export function DayBlock({ it, showTime = true }: { it: DayItem; showTime?: boolean }) {
  const check = useCheck();
  const openSeance = useUiStore((s) => s.openSeance);
  const open = () => {
    if (it.seance) openSeance(it.seance.id);
  };
  const block = (
    <div className={`bs-blk ${it.tone}${it.done ? " done" : ""}${it.late && !it.done ? " late" : ""}`}>
      <span className="ico" style={{ color: TONE_COLOR[it.tone] }}>
        <Picto name={pictoOf(it)} />
      </span>
      <button type="button" className="tx" onClick={open} style={{ textAlign: "left", cursor: it.seance ? "pointer" : "default" }}>
        <b>{it.title}</b>
        <span>{it.sub || (it.type === "task" ? "tâche d’équipe" : "")}</span>
      </button>
      {it.money ? <span className="money">{signed(it.money)}</span> : null}
      <button type="button" className={`bs-ck${it.done ? " on" : ""}`} onClick={() => (it.done ? open() : check(it))} aria-label={it.done ? `${it.title} : fait` : `Valider : ${it.title}`} aria-pressed={it.done}>
        <i>
          <Picto name="check" />
        </i>
      </button>
    </div>
  );
  if (!showTime) return block;
  return (
    <div className="bs-row">
      <span className="h">{it.start ?? "·"}</span>
      {block}
    </div>
  );
}
