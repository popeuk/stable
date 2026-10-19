"use client";

import { useState } from "react";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { F, InField, Jours, MoneyField, Puces, Repetition, Tiles, Toggles, Wheel, type SetD } from "@/components/bs/seance-form";
import type { Draft, Habitudes, Rep } from "@/lib/domain/ajouter";

/** Les étiquettes du métier, reprises du tableau du Clos (sans couleur : la couleur dit l'argent). */
export const LABELS = ["Urgent", "Chevaux", "Écurie", "Clients", "Travaux", "Admin"];

/**
 * Tâche ou rendez-vous, dans le + : « C’est quoi ? » en tuiles (les
 * dernières tâches, sinon des valeurs sûres) avec « Autre chose… », et le
 * « Plus de détails » qui garde tout ce que l'ancien formulaire savait faire :
 * la fin, le lieu ou la personne, pour qui, les étiquettes, la colonne du
 * tableau, le coût (partagé entre les chevaux une fois la tâche faite), le
 * rappel, la répétition, les notes. Sans heure, c'est une tâche ; avec une
 * heure, un rendez-vous.
 */
export function QuoiTiles({ d, set, h, other, setOther, onDone }: { d: Draft; set: SetD; h: Habitudes; other: boolean; setOther: (b: boolean) => void; onDone?: () => void }) {
  const known = h.quoi.includes(d.quoi);
  return (
    <Tiles
      options={h.quoi.map((x) => ({ key: x, label: x }))}
      value={known ? d.quoi : null}
      onPick={(quoi) => {
        setOther(false);
        set((x) => ({ ...x, quoi }));
        onDone?.();
      }}
      otherLabel="Autre chose…"
      otherOn={other || (!!d.quoi && !known)}
      onOther={() => {
        setOther(true);
        if (known) set((x) => ({ ...x, quoi: "" }));
      }}
      custom={known ? "" : d.quoi}
      onCustom={(quoi) => set((x) => ({ ...x, quoi }))}
      placeholder="Tape ce que c’est"
    />
  );
}

const REPEATS: [Rep, string][] = [
  ["once", "Une fois"],
  ["weekly", "Chaque semaine"],
  ["monthly", "Chaque mois"],
];
const RAPPELS = ["La veille", "1 h avant", "Pas de rappel"];

export function TaskDetails({ d, set, h, today }: { d: Draft; set: SetD; h: Habitudes; today: string }) {
  const data = useDataStore();
  const gerant = useSettingsStore((s) => s.gerant);
  const lists = data.taskLists ?? [];
  const members = [gerant, ...(data.team ?? []).filter((m) => m.role === "employe").map((m) => m.name)].filter(Boolean);
  const nbHorses = data.horses.filter((x) => !x.isArchived).length;
  const [other, setOther] = useState(!!d.quoi && !h.quoi.includes(d.quoi));
  const rdv = d.start != null;
  return (
    <>
      <F label="C’est quoi">
        <QuoiTiles d={d} set={set} h={h} other={other} setOther={setOther} />
      </F>
      <F label="Quel jour">
        <Jours date={d.date} today={today} onDate={(date) => set((x) => ({ ...x, date }))} />
      </F>
      <F label="À quelle heure" hint={rdv ? "c’est un rendez-vous" : "sans heure, c’est une tâche"}>
        <Wheel value={d.start} onPick={(t) => set((x) => ({ ...x, start: t }))} taskChip onTask={() => set((x) => ({ ...x, start: null, end: "" }))} />
      </F>
      {rdv && (
        <F label="Fin" hint="si tu veux">
          <input className="input nt-date" type="time" value={d.end} onChange={(e) => set((x) => ({ ...x, end: e.target.value }))} aria-label="Heure de fin" />
        </F>
      )}
      <F label="Où, ou avec qui ?">
        <InField className="nt-tin">
          <input placeholder="Ex. : Dr Martin, à la sellerie" aria-label="Où, ou avec qui" value={d.lieu} onChange={(e) => set((x) => ({ ...x, lieu: e.target.value }))} />
        </InField>
      </F>
      {members.length > 0 && (
        <F label="Qui s’en occupe ?">
          <Toggles options={members} value={d.qui} onChange={(qui) => set((x) => ({ ...x, qui }))} />
        </F>
      )}
      {!rdv && lists.length > 1 && (
        <F label="Où en est-elle ?">
          <Puces options={lists.map((l) => [l.id, l.title] as [string, string])} value={d.listId ?? lists[0]?.id} onPick={(listId) => set((x) => ({ ...x, listId }))} />
        </F>
      )}
      <F label="Étiquettes">
        <Toggles options={LABELS} value={d.labels} onChange={(labels) => set((x) => ({ ...x, labels }))} />
      </F>
      <F label="Ça coûte quelque chose ?" hint={`une fois faite, partagé entre ${nbHorses > 0 ? `tes ${nbHorses} chevaux` : "tous les chevaux"}`}>
        <MoneyField value={d.price} onChange={(price) => set((x) => ({ ...x, price }))} label="Ce que ça coûte" />
      </F>
      {rdv && (
        <F label="Rappel">
          <Puces options={RAPPELS.map((r) => [r, r] as [string, string])} value={d.rappel} onPick={(rappel) => set((x) => ({ ...x, rappel: x.rappel === rappel ? "" : rappel }))} />
        </F>
      )}
      <F label="Ça revient ?">
        <Repetition d={d} set={set} options={REPEATS} />
      </F>
      <F label="Notes">
        <textarea className="input ta nt-ta" rows={2} placeholder="Notes" aria-label="Notes" value={d.notes} onChange={(e) => set((x) => ({ ...x, notes: e.target.value }))} />
      </F>
    </>
  );
}
