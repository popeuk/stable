"use client";

import { useState } from "react";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
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
  return (
    <>
      <div className="bs-field" style={{ marginTop: 14 }}>
        <input autoFocus placeholder="Ex. Réparer la clôture du pré 2" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} aria-label="Titre de la tâche" />
      </div>
      <p className="bs-sec">Où en est-elle ?</p>
      <div className="bs-seg">
        {lists.map((l) => (
          <button key={l.id} type="button" aria-pressed={listId === l.id} onClick={() => setListId(l.id)}>
            {l.title}
          </button>
        ))}
      </div>
      <p className="bs-sec">Pour qui ?</p>
      <div className="bs-chips">
        {members.map((m) => (
          <button key={m} type="button" className="bs-chip" aria-pressed={forWho.includes(m)} onClick={() => setForWho(forWho.includes(m) ? forWho.filter((x) => x !== m) : [...forWho, m])}>
            {m}
          </button>
        ))}
      </div>
      <p className="bs-sec">Pour quand ?</p>
      <div className="bs-seg">
        {(["none", "today", "tomorrow", "other"] as const).map((w) => (
          <button key={w} type="button" aria-pressed={when === w} onClick={() => setWhen(w)}>
            {{ none: "Pas de date", today: "Aujourd’hui", tomorrow: "Demain", other: "Autre" }[w]}
          </button>
        ))}
      </div>
      {when !== "none" && (
        <div style={{ display: "grid", gridTemplateColumns: when === "other" ? "1fr 1fr" : "1fr", gap: 8 }}>
          {when === "other" && (
            <div className="bs-field">
              <input type="date" value={other} onChange={(e) => setOther(e.target.value)} aria-label="Date" />
            </div>
          )}
          <label className="bs-field">
            <span>Heure</span>
            <input type="time" value={time} style={{ textAlign: "right" }} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
      )}
      <p className="bs-sec">Étiquettes</p>
      <div className="bs-chips">
        {Object.entries(LABELS).map(([l, c]) => (
          <button key={l} type="button" className="bs-chip" aria-pressed={labels.includes(l)} onClick={() => setLabels(labels.includes(l) ? labels.filter((x) => x !== l) : [...labels, l])}>
            <i style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
            {l}
          </button>
        ))}
      </div>
      <label className="bs-sec" htmlFor="t-cost" style={{ display: "flex" }}>
        Ça coûte quelque chose ? <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>une fois la tâche faite, le montant va dans les frais communs, partagé entre tous les chevaux</span>
      </label>
      <div className="bs-field">
        <input id="t-cost" inputMode="decimal" placeholder="0" value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d.,]/g, ""))} />
        <span>€</span>
      </div>
      <button type="button" className="bs-btn" style={{ marginTop: 14 }} disabled={!title.trim()} onClick={save}>
        Ajouter la tâche
      </button>
    </>
  );
}
