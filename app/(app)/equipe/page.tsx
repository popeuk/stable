"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, esc, eur } from "@/components/bs/ui";
import { LABELS } from "@/components/bs/task-form";
import { PlanningTaches, PlanningTachesHaut } from "@/components/bs/planning-taches";
import { useDesk } from "@/components/bs/desk";
import { Check, Ic, Seg, ini, sg } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { localToday } from "@/lib/utils/local-date";
import type { TeamTask } from "@/lib/domain/types";

/**
 * Le tableau de l'équipe : des colonnes (À faire, En cours, Fait), des
 * cartes qu'on déplace d'un geste. Une carte avec un coût devient une
 * facture commune quand elle passe en « Fait ». Style : app/carnet/journee.css.
 */
export default function Page() {
  return (
    <ClientGate>
      <Equipe />
    </ClientGate>
  );
}

function dueLabel(due: string | undefined, today: string) {
  if (!due) return "";
  const d = due.slice(0, 10);
  const t = due.length > 10 ? ` ${due.slice(11, 16)}` : "";
  if (d === today) return `aujourd’hui${t}`;
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + t;
}

/** La bulle de commentaire (absente du jeu d'icônes). */
function Bulle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5h14v10H10l-4 4v-4H5z" />
    </svg>
  );
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
      l?.isDone && t.cost ? `C’est fait. <strong>${eur(t.cost)}</strong> ajoutés aux frais communs, partagés entre les chevaux.` : `Tâche rangée dans <strong>${esc(l?.title ?? "")}</strong>.`,
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

  const ouvertes = (data.tasks ?? []).filter((t) => !lists.find((l) => l.id === t.listId)?.isDone).length;
  const isDone = (t: TeamTask) => !!lists.find((l) => l.id === t.listId)?.isDone;
  // Un rendez-vous passé n'est pas « en retard » : il a eu lieu.
  const isLate = (t: TeamTask) => t.kind !== "rdv" && !!t.due && t.due.slice(0, 10) < today && !isDone(t);

  const card = (t: TeamTask) => {
    const late = isLate(t);
    const done = t.checklist.filter((c) => c.done).length;
    return (
      <button
        key={t.id}
        type="button"
        className={`jr-t${isDone(t) ? " jr-done" : ""}${drag === t.id ? " drag" : ""}`}
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
          <span className="jr-tags">
            {t.labels.map((l) => (
              <span key={l} className="jr-tag">
                {l}
              </span>
            ))}
          </span>
        )}
        <b>{t.title}</b>
        <span className="jr-meta">
          {t.due && (
            <span className={late ? "jr-late" : ""}>
              <Ic n="clock" className="" />
              {dueLabel(t.due, today)}
              {late ? ", en retard" : ""}
            </span>
          )}
          {t.checklist.length > 0 && (
            <span>
              <Ic n="list" className="" />
              {done}/{t.checklist.length}
            </span>
          )}
          {t.comments.length > 0 && (
            <span>
              <Bulle />
              {t.comments.length}
            </span>
          )}
          {t.cost ? <span className="out">{sg(-t.cost)}</span> : null}
          <span className="jr-ws">
            {t.forWho.map((w) => (
              <span key={w} className="jr-who" title={w}>
                {ini(w)}
              </span>
            ))}
          </span>
        </span>
      </button>
    );
  };

  const line = (t: TeamTask) => {
    const late = isLate(t);
    const done = t.checklist.filter((c) => c.done).length;
    const bits = [...t.labels, t.checklist.length ? `${done}/${t.checklist.length}` : ""].filter(Boolean);
    return (
      <button key={t.id} type="button" className="li jr-li" onClick={() => setOpen(t.id)}>
        <span className="ini">{t.forWho[0] ? ini(t.forWho[0]) : "·"}</span>
        <span>
          <b>{t.title}</b>
          <small>
            {bits.join(" · ")}
            {t.due && (
              <>
                {bits.length ? " · " : ""}
                {late ? <b className="jr-late">{dueLabel(t.due, today)}, en retard</b> : dueLabel(t.due, today)}
              </>
            )}
          </small>
        </span>
        {t.cost ? <span className="pill out">{sg(-t.cost)}</span> : <Ic n="chev" className="cn-ic sm chev" />}
      </button>
    );
  };

  return (
    <Screen wide={desk}>
      {!desk && <PlanningTachesHaut value="taches" count={ouvertes} />}
      <div className="jr-equipe">
        {desk && (
          <div style={{ marginBottom: 12 }}>
            <PlanningTaches value="taches" count={ouvertes} />
          </div>
        )}
        <div className="over rise" style={{ animationDelay: ".02s" }}>
          <span>{data.team?.length ? `${data.team.length + 1} personnes dans l’équipe` : "Toi et ton équipe"}</span>
          <button type="button" className="lnk" style={{ fontSize: 12.5, textDecoration: "none" }} onClick={() => openNoter({ mode: "tache" })}>
            Ajouter une tâche
          </button>
        </div>
        <div className="jr-ttl rise" style={{ animationDelay: ".05s" }}>
          <h3>Tâches d’équipe</h3>
        </div>
        <div className="jr-ctl rise" style={{ animationDelay: ".08s" }}>
          <Seg
            value={vue}
            onChange={pick}
            label="Tableau ou liste"
            options={[
              ["tableau", "Tableau"],
              ["liste", "Liste"],
            ]}
          />
          <div className="chips">
            <button type="button" className={`chip${mine ? " on" : ""}`} aria-pressed={mine} onClick={() => setMine(!mine)}>
              Pour moi
            </button>
          </div>
        </div>

        <div className="rise" style={{ animationDelay: ".14s" }}>
          {vue === "tableau" ? (
            <div className="jr-board">
              {lists.map((l) => {
                const ts = tasks.filter((t) => t.listId === l.id);
                return (
                  <section
                    key={l.id}
                    className={`jr-col${over === l.id ? " over" : ""}`}
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
                    <h5>
                      {l.title} <span>{ts.length}</span>
                    </h5>
                    {ts.map(card)}
                    {!l.isDone && (
                      <div className="jr-quick">
                        <input
                          className="input"
                          placeholder="Ajouter une tâche"
                          value={quick[l.id] ?? ""}
                          onChange={(e) => setQuick({ ...quick, [l.id]: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && addQuick(l.id)}
                          aria-label={`Ajouter une tâche dans ${l.title}`}
                        />
                        <button type="button" onClick={() => addQuick(l.id)} aria-label={`Ajouter la tâche dans ${l.title}`}>
                          <Ic n="plus" />
                        </button>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="pad">
              {lists.map((l) => {
                const ts = tasks.filter((t) => t.listId === l.id);
                if (!ts.length) return null;
                return (
                  <div key={l.id}>
                    <p className="k jr-k">
                      {l.title} · {ts.length}
                    </p>
                    {ts.map(line)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {tasks.length === 0 && (
          <div className="pad">
            <p className="note">{mine ? "Aucune tâche pour toi pour l’instant." : "Aucune tâche pour l’instant. Touche « Ajouter une tâche » en haut pour écrire la première."}</p>
          </div>
        )}
        <div className="pad rise" style={{ animationDelay: ".22s" }}>
          <p className="note jr-small">
            {desk ? "Glisse une tâche d’une colonne à l’autre. " : ""}Quand une tâche qui a un coût passe en « {lists.find((l) => l.isDone)?.title ?? "Fait"} », le montant va dans les frais communs, partagé entre les chevaux. Les tâches avec une date apparaissent aussi dans le planning.
          </p>
        </div>
        <div className="end" />
      </div>
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
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
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
  const addItem = () => {
    if (!item.trim()) return;
    upd({ checklist: [...t.checklist, { id: crypto.randomUUID(), text: item.trim(), done: false }] });
    setItem("");
  };
  const addComment = () => {
    if (!comment.trim()) return;
    upd({ comments: [...t.comments, { by: gerant, at: new Date().toISOString(), text: comment.trim() }] });
    setComment("");
  };

  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet" role="dialog" aria-modal="true" aria-label={t.title}>
          <div className="grab" />
          <div className="shd">
            <span className="jr-over">{t.createdBy ? `Créée par ${t.createdBy}` : "Tâche d’équipe"}</span>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          <div className="pad">
            <input className="jr-sh" defaultValue={t.title} onChange={(e) => e.target.value.trim() && upd({ title: e.target.value.trim() })} aria-label="Titre" />
            <p className="k jr-k">Où en est-elle ?</p>
            <Seg
              value={t.listId}
              label="Où en est-elle ?"
              onChange={(lid) => {
                if (t.listId === lid) return;
                const l = lists.find((x) => x.id === lid);
                const undo = snap();
                st().moveTask(t.id, lid);
                say(l?.isDone && t.cost ? `C’est fait. <strong>${eur(t.cost)}</strong> ajoutés aux frais communs, partagés entre les chevaux.` : `Tâche rangée dans <strong>${esc(l?.title ?? "")}</strong>.`, undo);
              }}
              options={lists.map((l) => [l.id, l.title] as [string, string])}
            />
            <p className="k jr-k">Pour qui ?</p>
            <div className="chips">
              {members.map((m) => (
                <button key={m} type="button" className={`chip${t.forWho.includes(m) ? " on" : ""}`} aria-pressed={t.forWho.includes(m)} onClick={() => upd({ forWho: t.forWho.includes(m) ? t.forWho.filter((x) => x !== m) : [...t.forWho, m] })}>
                  {m}
                </button>
              ))}
            </div>
            <p className="k jr-k">Étiquettes</p>
            <div className="chips">
              {Object.keys(LABELS).map((l) => (
                <button key={l} type="button" className={`chip${t.labels.includes(l) ? " on" : ""}`} aria-pressed={t.labels.includes(l)} onClick={() => upd({ labels: t.labels.includes(l) ? t.labels.filter((x) => x !== l) : [...t.labels, l] })}>
                  {l}
                </button>
              ))}
            </div>
            <p className="k jr-k">Étapes à cocher</p>
            {t.checklist.map((c) => (
              <div key={c.id} className="jr-step">
                <Check on={c.done} onClick={() => upd({ checklist: t.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })} label={`Étape : ${c.text}`} />
                <span>{c.text}</span>
                <button type="button" className="x jr-xs" aria-label={`Retirer ${c.text}`} onClick={() => upd({ checklist: t.checklist.filter((x) => x.id !== c.id) })}>
                  <Ic n="x" className="" />
                </button>
              </div>
            ))}
            <div className="jr-quick" style={{ marginTop: 8 }}>
              <input className="input" placeholder="Ajouter une étape" value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} aria-label="Ajouter une étape à cocher" />
              <button type="button" onClick={addItem} aria-label="Ajouter l’étape">
                <Ic n="plus" />
              </button>
            </div>
            <p className="k jr-k">Ça coûte combien ?</p>
            <label className="field">
              <span className="input">
                <input
                  inputMode="decimal"
                  defaultValue={t.cost ?? ""}
                  aria-label="Montant"
                  placeholder="0"
                  style={{ flex: 1, minWidth: 0, border: 0, background: "none", outline: "none", fontWeight: 600, padding: 0 }}
                  onChange={(e) => upd({ cost: Number(e.target.value.replace(",", ".")) > 0 ? Number(e.target.value.replace(",", ".")) : undefined })}
                  disabled={!!t.costExpenseId}
                />
                <span className="u">€</span>
              </span>
              {t.costExpenseId ? <em>Déjà compté dans les frais communs du mois, partagé entre les chevaux.</em> : <em>Passe dans les frais communs quand la tâche est faite.</em>}
            </label>
            <p className="k jr-k">Notes</p>
            <textarea className="input ta" rows={3} defaultValue={t.notes ?? ""} onChange={(e) => upd({ notes: e.target.value })} aria-label="Notes" />
            <p className="k jr-k">Commentaires</p>
            {t.comments.map((c, i) => (
              <div key={i} className="li">
                <span className="ini">{ini(c.by)}</span>
                <span>
                  <b>{c.by}</b>
                  <small>{c.text}</small>
                </span>
                <span />
              </div>
            ))}
            <div className="jr-quick" style={{ marginTop: 8 }}>
              <input className="input" placeholder="Écrire un commentaire" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addComment()} aria-label="Écrire un commentaire" />
              <button type="button" onClick={addComment} aria-label="Envoyer le commentaire">
                <Ic n="arrow" />
              </button>
            </div>
            <button
              type="button"
              className="btn line full"
              style={{ marginTop: 18 }}
              onClick={() => {
                const undo = snap();
                st().deleteTask(t.id);
                say(`Tâche supprimée : ${esc(t.title)}.`, undo);
                onClose();
              }}
            >
              <Ic n="trash" className="" />
              Supprimer la tâche
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
