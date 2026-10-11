"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, Sec, esc, eur } from "@/components/bs/ui";
import { Picto } from "@/components/bs/picto";
import { LABELS } from "@/components/bs/task-form";
import { useDesk } from "@/components/bs/desk";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { localToday } from "@/lib/utils/local-date";
import type { TeamTask } from "@/lib/domain/types";

/**
 * Le tableau de l'équipe : des colonnes (À faire, En cours, Fait), des
 * cartes qu'on déplace d'un geste. Une carte avec un coût devient une
 * facture commune quand elle passe en « Fait ».
 */
export default function Page() {
  return (
    <ClientGate>
      <Equipe />
    </ClientGate>
  );
}

const ini = (n: string) => n.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
function dueLabel(due: string | undefined, today: string) {
  if (!due) return "";
  const d = due.slice(0, 10);
  const t = due.length > 10 ? ` ${due.slice(11, 16)}` : "";
  if (d === today) return `aujourd’hui${t}`;
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + t;
}

function Equipe() {
  const data = useDataStore();
  const gerant = useSettingsStore((s) => s.gerant);
  const openNoter = useUiStore((s) => s.openNoter);
  const say = useUiStore((s) => s.say);
  const [vue, setVue] = useState<"tableau" | "liste">(() => {
    try {
      return (localStorage.getItem("bs:equipe-vue") as "tableau" | "liste") || "tableau";
    } catch {
      return "tableau";
    }
  });
  const [mine, setMine] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [quick, setQuick] = useState<Record<string, string>>({});
  const desk = useDesk();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  // Ordinateur : glisser une carte d'une colonne à l'autre.
  function drop(listId: string) {
    const id = drag;
    setDrag(null);
    setOver(null);
    const t = (useDataStore.getState().tasks ?? []).find((x) => x.id === id);
    if (!t || t.listId === listId) return;
    const st = useDataStore.getState();
    const snap = { tasks: st.tasks, sharedExpenses: st.sharedExpenses };
    st.moveTask(t.id, listId);
    const l = lists.find((x) => x.id === listId);
    say(
      l?.isDone && t.cost ? `Fait. <strong>${eur(t.cost)}</strong> ajoutés aux factures communes.` : `Carte déplacée dans <strong>${esc(l?.title ?? "")}</strong>.`,
      () => useDataStore.setState(snap),
    );
  }
  const today = localToday();
  const lists = data.taskLists ?? [];
  const tasks = useMemo(
    () => (data.tasks ?? []).filter((t) => !mine || t.forWho.includes(gerant)).sort((a, b) => a.sort - b.sort),
    [data.tasks, mine, gerant],
  );

  function pick(v: "tableau" | "liste") {
    setVue(v);
    try {
      localStorage.setItem("bs:equipe-vue", v);
    } catch {}
  }
  function addQuick(listId: string) {
    const title = (quick[listId] ?? "").trim();
    if (!title) return;
    useDataStore.getState().addTask({ title, listId, labels: [], forWho: [], createdBy: gerant });
    setQuick({ ...quick, [listId]: "" });
    say(`Tâche ajoutée : <strong>${esc(title)}</strong>.`);
  }

  const card = (t: TeamTask) => {
    const late = t.due && t.due.slice(0, 10) < today && !lists.find((l) => l.id === t.listId)?.isDone;
    const done = t.checklist.filter((c) => c.done).length;
    return (
      <button
        key={t.id}
        type="button"
        className={`bs-tcard${drag === t.id ? " drag" : ""}`}
        onClick={() => setOpen(t.id)}
        draggable={desk && vue === "tableau"}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", t.id);
          setDrag(t.id);
        }}
        onDragEnd={() => {
          setDrag(null);
          setOver(null);
        }}
      >
        {t.labels.length > 0 && (
          <span style={{ display: "block", marginBottom: 5 }}>
            {t.labels.map((l) => (
              <i key={l} className="lab" style={{ background: LABELS[l] ?? "var(--line)" }} title={l} />
            ))}
          </span>
        )}
        <b>{t.title}</b>
        <span className="meta">
          <span style={{ display: "flex", gap: 8, alignItems: "center", color: late ? "var(--rose-ink)" : undefined }}>
            {t.due && (
              <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
                <Picto name="clock" size={13} />
                {dueLabel(t.due, today)}
              </span>
            )}
            {t.checklist.length > 0 && (
              <span>
                {done}/{t.checklist.length}
              </span>
            )}
            {t.comments.length > 0 && (
              <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
                <Picto name="comment" size={13} />
                {t.comments.length}
              </span>
            )}
            {t.cost ? <span style={{ color: "#8C6A35", fontWeight: 600 }}>{eur(t.cost)}</span> : null}
          </span>
          <span style={{ paddingLeft: 4 }}>
            {t.forWho.map((w) => (
              <span key={w} className="bs-who" title={w}>
                {ini(w)}
              </span>
            ))}
          </span>
        </span>
      </button>
    );
  };

  return (
    <Screen wide={desk}>
      <div className="bs-over">
        <span>{data.team?.length ? `${data.team.length + 1} dans l’équipe` : "Toi et ton équipe"}</span>
        <button type="button" className="bs-link" onClick={() => openNoter({ mode: "tache" })}>
          Nouvelle tâche
        </button>
      </div>
      <h1 className="bs-d bs-t1">Tâches d’équipe</h1>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
        <div className="bs-seg" style={{ flex: desk ? "0 0 260px" : 1, marginTop: 0 }}>
          <button type="button" aria-pressed={vue === "tableau"} onClick={() => pick("tableau")}>
            Tableau
          </button>
          <button type="button" aria-pressed={vue === "liste"} onClick={() => pick("liste")}>
            Liste
          </button>
        </div>
        <button type="button" className="bs-chip" aria-pressed={mine} onClick={() => setMine(!mine)}>
          Pour moi
        </button>
      </div>

      {vue === "tableau" ? (
        <div className="bs-board">
          {lists.map((l) => {
            const ts = tasks.filter((t) => t.listId === l.id);
            return (
              <section
                key={l.id}
                className={`bs-colb${over === l.id ? " over" : ""}`}
                aria-label={l.title}
                onDragOver={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  if (over !== l.id) setOver(l.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  drop(l.id);
                }}
              >
                <h3>
                  {l.title} <span>{ts.length}</span>
                </h3>
                {ts.map(card)}
                {!l.isDone && (
                  <div className="bs-quick">
                    <input
                      placeholder="Ajouter une carte"
                      value={quick[l.id] ?? ""}
                      onChange={(e) => setQuick({ ...quick, [l.id]: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && addQuick(l.id)}
                      aria-label={`Ajouter une carte dans ${l.title}`}
                    />
                    <button type="button" className="bs-chip" onClick={() => addQuick(l.id)} aria-label="Ajouter">
                      <Picto name="plus" size={16} />
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        lists.map((l) => {
          const ts = tasks.filter((t) => t.listId === l.id);
          if (!ts.length) return null;
          return (
            <div key={l.id}>
              <Sec>
                {l.title} · {ts.length}
              </Sec>
              {ts.map(card)}
            </div>
          );
        })
      )}
      {tasks.length === 0 && <p className="bs-p" style={{ marginTop: 12 }}>{mine ? "Rien ne t’est attribué." : "Aucune tâche. Ajoute la première avec le +."}</p>}
      <p className="bs-p" style={{ fontSize: 12, marginTop: 14 }}>
        {desk ? "Glisse une carte d’une colonne à l’autre. " : ""}Une carte avec un coût devient une facture commune quand elle passe en « {lists.find((l) => l.isDone)?.title ?? "Fait"} ». Les tâches datées apparaissent aussi au planning.
      </p>
      {open && <TaskSheet id={open} onClose={() => setOpen(null)} />}
    </Screen>
  );
}

function TaskSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const data = useDataStore();
  const gerant = useSettingsStore((s) => s.gerant);
  const say = useUiStore((s) => s.say);
  const t = (data.tasks ?? []).find((x) => x.id === id);
  const [item, setItem] = useState("");
  const [comment, setComment] = useState("");
  if (!t) return null;
  const st = useDataStore.getState;
  const lists = data.taskLists ?? [];
  const members = [gerant, ...(data.team ?? []).filter((m) => m.role === "employe").map((m) => m.name)];
  const upd = (p: Partial<TeamTask>) => st().updateTask(t.id, p);
  const snap = () => {
    const s = st();
    const v = { tasks: s.tasks, sharedExpenses: s.sharedExpenses };
    return () => useDataStore.setState(v);
  };

  return createPortal(
    <>
      <div className="bs-scrim" onClick={onClose} />
      <div className="bs-sheet" role="dialog" aria-label={t.title}>
        <div className="bs-grab" />
        <button type="button" className="bs-x" onClick={onClose} aria-label="Fermer">
          <Picto name="x" size={20} />
        </button>
        <input className="bs-d bs-t2" style={{ border: 0, background: "none", width: "88%", padding: 0, marginTop: 6 }} defaultValue={t.title} onChange={(e) => e.target.value.trim() && upd({ title: e.target.value.trim() })} aria-label="Titre" />
        <p className="bs-sec">Colonne</p>
        <div className="bs-seg">
          {lists.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={t.listId === l.id}
              onClick={() => {
                if (t.listId === l.id) return;
                const undo = snap();
                st().moveTask(t.id, l.id);
                say(l.isDone && t.cost ? `Fait. <strong>${eur(t.cost)}</strong> ajoutés aux factures communes.` : `Carte déplacée dans <strong>${esc(l.title)}</strong>.`, undo);
              }}
            >
              {l.title}
            </button>
          ))}
        </div>
        <p className="bs-sec">Pour qui</p>
        <div className="bs-chips">
          {members.map((m) => (
            <button key={m} type="button" className="bs-chip" aria-pressed={t.forWho.includes(m)} onClick={() => upd({ forWho: t.forWho.includes(m) ? t.forWho.filter((x) => x !== m) : [...t.forWho, m] })}>
              {m}
            </button>
          ))}
        </div>
        <p className="bs-sec">Étiquettes</p>
        <div className="bs-chips">
          {Object.entries(LABELS).map(([l, c]) => (
            <button key={l} type="button" className="bs-chip" aria-pressed={t.labels.includes(l)} onClick={() => upd({ labels: t.labels.includes(l) ? t.labels.filter((x) => x !== l) : [...t.labels, l] })}>
              <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: c, marginRight: 6 }} />
              {l}
            </button>
          ))}
        </div>
        <p className="bs-sec">Liste de contrôle</p>
        {t.checklist.map((c) => (
          <label key={c.id} className="bs-li" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={c.done} onChange={() => upd({ checklist: t.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })} style={{ width: 18, height: 18, accentColor: "var(--vert)" }} />
            <span className="tx" style={{ textDecoration: c.done ? "line-through" : undefined, color: c.done ? "var(--ink-3)" : undefined }}>
              {c.text}
            </span>
            <button type="button" className="bs-x" style={{ float: "none", margin: 0, width: 30, height: 30 }} aria-label={`Retirer ${c.text}`} onClick={() => upd({ checklist: t.checklist.filter((x) => x.id !== c.id) })}>
              <Picto name="x" size={14} />
            </button>
          </label>
        ))}
        <div className="bs-quick">
          <input
            placeholder="Ajouter un élément"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && item.trim()) {
                upd({ checklist: [...t.checklist, { id: crypto.randomUUID(), text: item.trim(), done: false }] });
                setItem("");
              }
            }}
            aria-label="Ajouter un élément à la liste"
          />
        </div>
        <p className="bs-sec">Coût</p>
        <label className="bs-field">
          <span>Montant</span>
          <input inputMode="decimal" defaultValue={t.cost ?? ""} style={{ textAlign: "right", fontWeight: 600 }} onChange={(e) => upd({ cost: Number(e.target.value.replace(",", ".")) > 0 ? Number(e.target.value.replace(",", ".")) : undefined })} disabled={!!t.costExpenseId} />
          <span>€</span>
        </label>
        {t.costExpenseId && <p className="bs-p" style={{ fontSize: 12 }}>Déjà compté dans les factures communes du mois.</p>}
        <p className="bs-sec">Notes</p>
        <div className="bs-field">
          <textarea rows={3} defaultValue={t.notes ?? ""} onChange={(e) => upd({ notes: e.target.value })} aria-label="Notes" style={{ width: "100%", border: 0, background: "none", resize: "vertical", font: "inherit" }} />
        </div>
        <p className="bs-sec">Commentaires</p>
        {t.comments.map((c, i) => (
          <div key={i} className="bs-li">
            <span className="bs-ini">{ini(c.by)}</span>
            <span className="tx">
              <b>{c.by}</b>
              <span>{c.text}</span>
            </span>
          </div>
        ))}
        <div className="bs-quick">
          <input
            placeholder="Écrire un commentaire"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && comment.trim()) {
                upd({ comments: [...t.comments, { by: gerant, at: new Date().toISOString(), text: comment.trim() }] });
                setComment("");
              }
            }}
            aria-label="Écrire un commentaire"
          />
        </div>
        <button
          type="button"
          className="bs-btn line"
          style={{ marginTop: 18, color: "var(--rose-ink)" }}
          onClick={() => {
            const undo = snap();
            st().deleteTask(t.id);
            say(`Tâche supprimée : ${esc(t.title)}.`, undo);
            onClose();
          }}
        >
          Supprimer la tâche
        </button>
      </div>
    </>,
    document.body,
  );
}
