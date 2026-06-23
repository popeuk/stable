"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { LessonTerm } from "@/components/pedagogy/lesson-term";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { distribute } from "@/lib/domain/distribution";
import type { DistributionMode } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { formatEur } from "@/lib/utils/format-currency";

export default function SaisieMutualiseePage() {
  return (
    <ClientGate>
      <SaisieMutualisee />
    </ClientGate>
  );
}

function SaisieMutualisee() {
  const router = useRouter();
  const data = useDataStore();
  const period = usePeriodStore((s) => s.active);
  const addSharedExpense = useDataStore((s) => s.addSharedExpense);

  const horses = data.horses.filter((h) => !h.isArchived);
  const sharedCats = data.expenseCategories.filter((c) => !c.isDirect);

  const [label, setLabel] = useState("");
  const [total, setTotal] = useState("");
  const [categoryId, setCategoryId] = useState(sharedCats[0]?.id);
  const [mode, setMode] = useState<DistributionMode>("equal");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(horses.map((h) => h.id)),
  );

  const selectedHorses = horses.filter((h) => selected.has(h.id));
  const totalNum = Number(total) || 0;

  const allocations = useMemo(
    () => distribute(totalNum, selectedHorses, mode, period),
    [totalNum, selectedHorses, mode, period],
  );

  const canSave = label.trim() && totalNum > 0 && selectedHorses.length > 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = selectedHorses.length === horses.length && horses.length > 0;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(horses.map((h) => h.id)));
  }

  function save() {
    if (!canSave) return;
    addSharedExpense({
      categoryId,
      label: label.trim(),
      totalAmount: totalNum,
      periodMonth: period.month,
      periodYear: period.year,
      distributionMode: mode,
      source: "manual",
      allocations,
    });
    router.push("/maintenant");
  }

  const nameOf = (id: string) => horses.find((h) => h.id === id)?.name ?? "";

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-tertiary">
        <ChevronLeft size={16} /> Annuler
      </button>
      <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">
        <LessonTerm lessonKey="charges_mutualisees">Charge mutualisée</LessonTerm>
      </h1>

      <Field label="Libellé">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Foin, granulés, personnel…"
          className="w-full rounded-[var(--radius-md)] border bg-elevated px-4 py-3 text-sm text-primary outline-none"
        />
      </Field>

      <Field label="Montant total">
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border bg-elevated px-4 py-3">
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className="w-full bg-transparent text-2xl tabnums text-primary outline-none"
          />
          <span className="text-xl text-tertiary">€</span>
        </div>
      </Field>

      <Field label="Catégorie">
        <div className="flex flex-wrap gap-2">
          {sharedCats.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs",
                categoryId === c.id ? "border-[var(--accent-primary)] text-[var(--accent-primary)]" : "text-tertiary",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Répartir sur">
        <button
          onClick={toggleAll}
          className="mb-2 border border-[var(--border-strong)] px-3 py-1.5 text-xs font-bold text-primary"
        >
          {allSelected ? "Tout décocher" : "Tout sélectionner"} · {selectedHorses.length}/{horses.length}
        </button>
        <div className="grid grid-cols-2 gap-2">
          {horses.map((h) => (
            <button
              key={h.id}
              onClick={() => toggle(h.id)}
              className={cn(
                "rounded-[var(--radius-md)] border px-3 py-2 text-left text-sm",
                selected.has(h.id)
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-primary"
                  : "text-tertiary",
              )}
            >
              {h.name}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Mode de répartition">
        <div className="flex gap-2">
          {(
            [
              { v: "equal", l: "Égal" },
              { v: "weighted_by_days", l: "Par jours de présence" },
            ] as { v: DistributionMode; l: string }[]
          ).map((opt) => (
            <button
              key={opt.v}
              onClick={() => setMode(opt.v)}
              className={cn(
                "flex-1 rounded-[var(--radius-md)] border px-3 py-2.5 text-xs",
                mode === opt.v ? "border-[var(--accent-primary)] text-[var(--accent-primary)]" : "text-tertiary",
              )}
            >
              {opt.l}
            </button>
          ))}
        </div>
        {mode === "weighted_by_days" && (
          <p className="mt-2 text-2xs text-tertiary">
            <LessonTerm lessonKey="repartition_jours">
              Pondéré par les jours réellement passés à l&apos;écurie ce mois.
            </LessonTerm>
          </p>
        )}
      </Field>

      {/* Live preview */}
      {totalNum > 0 && selectedHorses.length > 0 && (
        <section className="rounded-[var(--radius-lg)] border bg-elevated p-4">
          <p className="mb-3 text-2xs uppercase tracking-wide text-tertiary">Aperçu de la répartition</p>
          <div className="space-y-1.5">
            {allocations.map((a) => (
              <div key={a.horseId} className="flex justify-between text-sm">
                <span className="text-secondary">
                  {nameOf(a.horseId)}
                  {a.presenceDays != null && (
                    <span className="ml-1 text-2xs text-tertiary">· {a.presenceDays} j</span>
                  )}
                </span>
                <span className="tabnums text-primary">{formatEur(a.allocatedAmount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <button
        disabled={!canSave}
        onClick={save}
        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] py-3.5 text-sm font-medium text-[#0e0f0c] disabled:opacity-40"
        style={{ background: "var(--accent-primary)" }}
      >
        <Check size={18} /> Enregistrer
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-2xs uppercase tracking-wide text-tertiary">{label}</p>
      {children}
    </div>
  );
}
