"use client";

import { useState } from "react";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { Seg } from "@/components/carnet/ui";
import { InField } from "@/components/bs/seance-form";
import { esc } from "@/components/bs/ui";
import { localToday } from "@/lib/utils/local-date";
import { addDays } from "@/lib/domain/care";

/** Les étiquettes du métier, reprises du tableau du Clos. */
export const LABELS: Record<string, string> = {
  Urgent: "#8E3A5C",
  Chevaux: "#134E3A",
  Écurie: "#8C6A35",
  Clients: "#F6B3CB",
  Travaux: "#7A7284",
  Admin: "#1B1225",
};

/** Ajouter une tâche d'équipe : titre, colonne, pour qui, échéance, étiquettes, coût. */
export function TaskForm({ onDone, listId: presetList }: { onDone: () => void; listId?: string }) {
  const data = useDataStore();
  const addTask = useDataStore((s) => s.addTask);
  const gerant = useSettingsStore((s) => s.gerant);
  const say = useUiStore((s) => s.say);
  const lists = data.taskLists ?? [];
  const members = [gerant, ...(data.team ?? []).filter((m) => m.role === "employe").map((m) => m.name)];
  const nbHorses = data.horses.filter((h) => !h.isArchived).length;
  const today = localToday();
  const [title, setTitle] = useState("");
  const [listId, setListId] = useState(presetList ?? lists[0]?.id ?? "");
  const [forWho, setForWho] = useState<string[]>([]);
  const [when, setWhen] = useState<"none" | "today" | "tomorrow" | "other">("none");
  const [other, setOther] = useState(addDays(today, 2));
  const [time, setTime] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [cost, setCost] = useState("");

  const date = when === "today" ? today : when === "tomorrow" ? addDays(today, 1) : when === "other" ? other : undefined;
  function save() {
    if (!title.trim() || !listId) return;
    addTask({
      title: title.trim(),
      listId,
      labels,
      forWho,
      due: date ? (time ? `${date}T${time}` : date) : undefined,
      cost: Number(cost.replace(",", ".")) > 0 ? Number(cost.replace(",", ".")) : undefined,
      createdBy: gerant,
    });
    say(`Tâche ajoutée : <strong>${esc(title.trim())}</strong>.`);
    onDone();
  }
  const toggle = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  return (
    <div className="form nt-form">
      <label className="field">
        <span>La tâche</span>
        <input className="input" autoFocus placeholder="Ex. Réparer la clôture du pré 2" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} aria-label="Titre de la tâche" />
      </label>
      {lists.length > 0 && (
        <div className="field">
          <span>Où en est-elle ?</span>
          <Seg label="Où en est-elle ?" value={listId} onChange={setListId} options={lists.map((l) => [l.id, l.title] as [string, string])} />
        </div>
      )}
      <div className="field">
        <span>Pour qui ?</span>
        <div className="chips">
          {members.map((m) => (
            <button key={m} type="button" className={`chip${forWho.includes(m) ? " on" : ""}`} aria-pressed={forWho.includes(m)} onClick={() => setForWho(toggle(forWho, m))}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Pour quand ?</span>
        <Seg
          label="Pour quand ?"
          value={when}
          onChange={setWhen}
          options={[
            ["none", "Pas de date"],
            ["today", "Aujourd’hui"],
            ["tomorrow", "Demain"],
            ["other", "Autre"],
          ]}
        />
      </div>
      {when !== "none" && (
        <div className={when === "other" ? "nt-two" : ""}>
          {when === "other" && (
            <label className="field">
              <span>Date</span>
              <input className="input" type="date" value={other} onChange={(e) => setOther(e.target.value)} />
            </label>
          )}
          <label className="field">
            <span>Heure</span>
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
      )}
      <div className="field">
        <span>Étiquettes</span>
        <div className="chips">
          {Object.keys(LABELS).map((l) => (
            <button key={l} type="button" className={`chip${labels.includes(l) ? " on" : ""}`} aria-pressed={labels.includes(l)} onClick={() => setLabels(toggle(labels, l))}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>Ça coûte quelque chose ?</span>
        <InField unit="€">
          <input id="t-cost" inputMode="decimal" placeholder="0" value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d.,]/g, ""))} />
        </InField>
        <em>
          Une fois la tâche faite, le montant va dans les frais communs, partagé entre {nbHorses > 0 ? `tes ${nbHorses} chevaux` : "tous les chevaux"}.
        </em>
      </label>
      <button type="button" className="btn full" disabled={!title.trim()} onClick={save}>
        Ajouter la tâche
      </button>
    </div>
  );
}
