"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { useDataStore } from "@/stores/data-store";
import type { TeamRole } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { localToday } from "@/lib/utils/local-date";

/**
 * L'équipe : employés et prestataires réguliers. On les retrouve en un tap
 * dans « Qui s'en occupe ? » quand on ajoute quelque chose au planning —
 * c'est l'assignation des tâches, sans écran de plus.
 */
export default function EquipePage() {
  return (
    <ClientGate>
      <Equipe />
    </ClientGate>
  );
}

function Equipe() {
  const team = useDataStore((s) => s.team) ?? [];
  const careEvents = useDataStore((s) => s.careEvents) ?? [];
  const addTeamMember = useDataStore((s) => s.addTeamMember);
  const deleteTeamMember = useDataStore((s) => s.deleteTeamMember);
  const [name, setName] = useState("");
  const [job, setJob] = useState("");
  const [role, setRole] = useState<TeamRole>("employe");
  const today = localToday();

  // Les tâches à venir de chacun, dérivées du planning : rien à ressaisir.
  const upcoming = (memberName: string) =>
    careEvents.filter((e) => e.provider === memberName && (e.pending || e.date >= today))
      .length;

  function save() {
    if (!name.trim()) return;
    addTeamMember({ name, job: job.trim() || undefined, role });
    setName("");
    setJob("");
  }

  return (
    <div className="space-y-6">
      <Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-tertiary">
        <ChevronLeft size={16} /> Réglages
      </Link>
      <div>
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">
          L&apos;équipe
        </h1>
        <p className="mt-1 text-[13px] text-secondary">
          Tes employés et tes prestataires réguliers. Quand tu ajoutes une séance ou un
          rendez-vous, tu les assignes en un tap (« Qui s&apos;en occupe ? »).
        </p>
      </div>

      {team.length > 0 && (
        <div className="divide-y rounded-[var(--radius-lg)] border bg-elevated px-4">
          {team.map((m) => {
            const n = upcoming(m.name);
            return (
              <div key={m.id} className="flex items-center gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-primary">
                    {m.name}
                    {m.job ? <span className="font-normal text-secondary"> · {m.job}</span> : null}
                  </p>
                  <p className="text-[12px] text-tertiary">
                    {m.role === "employe" ? "Employé" : "Prestataire"}
                    {n > 0 ? ` · ${n} tâche${n > 1 ? "s" : ""} à venir` : ""}
                  </p>
                </div>
                <button
                  onClick={() =>
                    confirm(`Retirer ${m.name} de l'équipe ? (son historique reste au carnet)`) &&
                    deleteTeamMember(m.id)
                  }
                  aria-label={`Retirer ${m.name}`}
                  className="shrink-0 p-1 text-tertiary hover:text-[var(--c-danger)]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Ajouter quelqu'un */}
      <div className="space-y-3 rounded-[var(--radius-lg)] border bg-elevated p-4">
        <div className="grid grid-cols-2 overflow-hidden rounded-full border border-[var(--border-strong)]">
          {(
            [
              { v: "employe", l: "Employé" },
              { v: "prestataire", l: "Prestataire" },
            ] as { v: TeamRole; l: string }[]
          ).map((o) => (
            <button
              key={o.v}
              onClick={() => setRole(o.v)}
              className={cn("py-2 text-[13px] font-bold")}
              style={{
                background: role === o.v ? "var(--ink)" : "transparent",
                color: role === o.v ? "var(--on-ink)" : "var(--text-primary)",
              }}
            >
              {o.l}
            </button>
          ))}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={role === "employe" ? "Julie" : "M. Roche"}
          className="w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-base px-3 py-2.5 text-sm text-primary outline-none"
        />
        <input
          value={job}
          onChange={(e) => setJob(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder={role === "employe" ? "Monitrice, palefrenier… (optionnel)" : "Maréchal, vétérinaire… (optionnel)"}
          className="w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-base px-3 py-2.5 text-sm text-primary outline-none"
        />
        <button
          onClick={save}
          disabled={!name.trim()}
          className="btn-primary flex w-full items-center justify-center gap-1.5 py-2.5 text-[14px] text-[var(--on-accent)] disabled:opacity-40"
        >
          <Plus size={15} /> Ajouter à l&apos;équipe
        </button>
      </div>
    </div>
  );
}
