"use client";

import { useState } from "react";
import { Empty, Ic, Sec, Seg, ini } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import type { TeamRole } from "@/lib/domain/types";
import { localToday } from "@/lib/utils/local-date";

/**
 * Deux parties de Réglages (app/(app)/moi) : l'équipe et les catégories.
 * Tout se règle sur un seul écran ; les anciennes adresses /parametres/…
 * l'ouvrent sur leur partie.
 */

/* ---------- L'équipe ---------- */
/**
 * Employés et prestataires réguliers. On les retrouve en un tap dans
 * « Qui s'en occupe ? » quand on ajoute quelque chose au planning.
 */
export function EquipeReglages() {
  const team = useDataStore((s) => s.team) ?? [];
  const careEvents = useDataStore((s) => s.careEvents) ?? [];
  const addTeamMember = useDataStore((s) => s.addTeamMember);
  const deleteTeamMember = useDataStore((s) => s.deleteTeamMember);
  const [name, setName] = useState("");
  const [job, setJob] = useState("");
  const [role, setRole] = useState<TeamRole>("employe");
  const today = localToday();

  // Les tâches à venir de chacun, dérivées du planning : rien à ressaisir.
  const upcoming = (memberName: string) => careEvents.filter((e) => e.provider === memberName && (e.pending || e.date >= today)).length;

  function save() {
    if (!name.trim()) return;
    addTeamMember({ name, job: job.trim() || undefined, role });
    setName("");
    setJob("");
  }

  return (
    <Sec title="Ton équipe" delay={0.2} id="equipe">
      {team.length === 0 && <Empty ill="equipe">Les gens qui travaillent avec toi : salariés, maréchal, véto…</Empty>}
      {team.map((m) => {
        const n = upcoming(m.name);
        return (
          <div key={m.id} className="li">
            <span className="ini">{ini(m.name)}</span>
            <span>
              <b>
                {m.name}
                {m.job ? ` · ${m.job}` : ""}
              </b>
              <small>
                {m.role === "employe" ? "Salarié" : "Pro extérieur"}
                {n > 0 ? ` · ${n} tâche${n > 1 ? "s" : ""} à venir` : ""}
              </small>
            </span>
            <button type="button" className="x" onClick={() => confirm(`Retirer ${m.name} de l’équipe ? Ce qu’il a fait reste noté dans le carnet des chevaux.`) && deleteTeamMember(m.id)} aria-label={`Retirer ${m.name}`}>
              <Ic n="x" className="" />
            </button>
          </div>
        );
      })}
      <div className="ec-addp">
        <p className="k">Ajouter quelqu’un</p>
        <Seg<TeamRole>
          value={role}
          onChange={setRole}
          label="Son rôle"
          options={[
            ["employe", "Salarié"],
            ["prestataire", "Pro extérieur"],
          ]}
        />
        <label className="input">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={role === "employe" ? "Son nom, ex. Julie" : "Son nom, ex. M. Roche"} aria-label="Son nom" />
        </label>
        <label className="input">
          <input value={job} onChange={(e) => setJob(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder={role === "employe" ? "Son métier (facultatif)" : "Maréchal, vétérinaire… (facultatif)"} aria-label="Son métier (facultatif)" />
        </label>
        <button type="button" className="btn full" onClick={save} disabled={!name.trim()}>
          <Ic n="plus" className="" />
          Ajouter à l’équipe
        </button>
      </div>
      <p className="ec-help">Quand tu ajoutes une séance ou un rendez-vous, tu choisis qui s’en occupe en un geste.</p>
    </Sec>
  );
}

/* ---------- Catégories ---------- */
type Tab = "revenus" | "directes" | "mutualisees";

export function CategoriesReglages() {
  const data = useDataStore();
  const addRevenueCategory = useDataStore((s) => s.addRevenueCategory);
  const addExpenseCategory = useDataStore((s) => s.addExpenseCategory);
  const deleteRevenueCategory = useDataStore((s) => s.deleteRevenueCategory);
  const deleteExpenseCategory = useDataStore((s) => s.deleteExpenseCategory);
  const [tab, setTab] = useState<Tab>("revenus");
  const [draft, setDraft] = useState("");

  const list = tab === "revenus" ? data.revenueCategories : data.expenseCategories.filter((c) => (tab === "directes" ? c.isDirect : !c.isDirect));

  function add() {
    const name = draft.trim();
    if (!name) return;
    if (tab === "revenus") addRevenueCategory(name);
    else addExpenseCategory(name, tab === "directes");
    setDraft("");
  }

  function remove(catId: string) {
    if (tab === "revenus") deleteRevenueCategory(catId);
    else deleteExpenseCategory(catId);
  }

  return (
    <Sec title="Tes catégories" delay={0.3} id="categories">
      <p className="note">Les étiquettes que tu choisis quand tu notes de l’argent. Ajoute les tiennes, retire celles qui ne te servent pas.</p>
      <div className="ec-segw">
        <Seg<Tab>
          value={tab}
          onChange={setTab}
          label="Type de catégorie"
          options={[
            ["revenus", "Ce qui rentre"],
            ["directes", "Pour un cheval"],
            ["mutualisees", "Frais communs"],
          ]}
        />
      </div>
      <div className="ec-cadd">
        <label className="input">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Nouvelle catégorie" aria-label="Nom de la nouvelle catégorie" />
        </label>
        <button type="button" className="btn" onClick={add} aria-label="Ajouter cette catégorie">
          <Ic n="plus" className="" />
        </button>
      </div>
      <div style={{ marginTop: 6 }}>
        {list.map((c) => (
          <div key={c.id} className="ec-cat">
            <span>{c.name}</span>
            <button type="button" className="x" onClick={() => remove(c.id)} aria-label={`Retirer ${c.name}`}>
              <Ic n="x" className="" />
            </button>
          </div>
        ))}
        {list.length === 0 && <p className="note">Aucune catégorie ici. Tape un nom au-dessus pour en ajouter une.</p>}
      </div>
    </Sec>
  );
}
