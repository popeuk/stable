"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { Explain } from "@/components/ed/explain";
import { useDataStore } from "@/stores/data-store";
import { useFlashStore } from "@/stores/flash-store";
import type { DistributionMode, Frequency } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { formatEur } from "@/lib/utils/format-currency";

export default function SaisieRecurrentePage() {
  return (
    <ClientGate>
      <SaisieRecurrente />
    </ClientGate>
  );
}

const FREQS: { v: Frequency; l: string }[] = [
  { v: "monthly", l: "Mensuelle" },
  { v: "quarterly", l: "Trimestrielle" },
  { v: "yearly", l: "Annuelle" },
];

function SaisieRecurrente() {
  const router = useRouter();
  const data = useDataStore();
  const addRecurring = useDataStore((s) => s.addRecurringExpense);

  const horses = data.horses.filter((h) => !h.isArchived);
  const [shared, setShared] = useState(true);
  const [horseId, setHorseId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const cats = data.expenseCategories.filter((c) => (shared ? !c.isDirect : c.isDirect));
  const [categoryId, setCategoryId] = useState(cats[0]?.id);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [mode, setMode] = useState<DistributionMode>("equal");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [hasEnd, setHasEnd] = useState(false);
  const [end, setEnd] = useState("");

  const canSave =
    label.trim() && Number(amount) > 0 && (shared || horseId) && start && (!hasEnd || end);

  function save() {
    if (!canSave) return;
    useFlashStore.getState().setFlash({
      kind: "expense",
      amount: Number(amount),
      label: `${label.trim()} — récurrente`,
    });
    addRecurring({
      label: label.trim(),
      amount: Number(amount),
      categoryId,
      isShared: shared,
      horseId: shared ? undefined : horseId!,
      distributionMode: shared ? mode : undefined,
      frequency,
      startDate: start,
      endDate: hasEnd ? end : null,
      source: "manual",
    });
    router.push("/depenses");
  }

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-tertiary">
        <ChevronLeft size={16} /> Annuler
      </button>
      <div>
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">
          Charge récurrente
        </h1>
        <p className="mt-1 text-[13px] text-secondary">
          Un crédit, un abonnement, l&apos;assurance… avec une{" "}
          <Explain k="depenses" className="text-[var(--accent-primary)]">
            date de début et de fin
          </Explain>
          .
        </p>
      </div>

      <Field label="Pour qui ?">
        <div className="grid grid-cols-2 overflow-hidden rounded-full border border-[var(--border-strong)]">
          {[
            { v: true, l: "Toute l'écurie" },
            { v: false, l: "Un cheval" },
          ].map((o) => (
            <button
              key={String(o.v)}
              onClick={() => setShared(o.v)}
              className="py-2.5 text-[14px] font-bold"
              style={{
                background: shared === o.v ? "var(--text-primary)" : "transparent",
                color: shared === o.v ? "var(--on-ink)" : "var(--text-primary)",
              }}
            >
              {o.l}
            </button>
          ))}
        </div>
      </Field>

      {!shared && (
        <Field label="Quel cheval ?">
          <div className="flex flex-wrap gap-2">
            {horses.map((h) => (
              <button
                key={h.id}
                onClick={() => setHorseId(h.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[13px] font-bold",
                  horseId === h.id
                    ? "border-[var(--text-primary)] bg-[var(--ink)] text-[var(--on-ink)]"
                    : "border-[var(--border-strong)] text-tertiary",
                )}
              >
                {h.name}
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field label="Libellé">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Crédit matériel, abonnement…"
          className="w-full card px-4 py-3 text-sm text-primary outline-none"
        />
      </Field>

      <Field label="Montant par échéance">
        <div className="flex items-center gap-2 card px-4 py-3">
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-transparent text-2xl tabular-nums text-primary outline-none"
          />
          <span className="text-xl text-tertiary">€</span>
        </div>
      </Field>

      <Field label="Fréquence">
        <div className="flex gap-2">
          {FREQS.map((f) => (
            <button
              key={f.v}
              onClick={() => setFrequency(f.v)}
              className={cn(
                "flex-1 rounded-full border px-2 py-2 text-[13px] font-bold",
                frequency === f.v
                  ? "border-[var(--text-primary)] bg-[var(--accent-primary)] text-[var(--on-accent)]"
                  : "border-[var(--border-strong)] text-tertiary",
              )}
            >
              {f.l}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Catégorie">
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                categoryId === c.id
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]"
                  : "border-[var(--border-strong)] text-tertiary",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </Field>

      {shared && (
        <Field label="Répartition">
          <div className="flex gap-2">
            {([
              { v: "equal", l: "Égale" },
              { v: "weighted_by_days", l: "Par jours" },
            ] as { v: DistributionMode; l: string }[]).map((o) => (
              <button
                key={o.v}
                onClick={() => setMode(o.v)}
                className={cn(
                  "flex-1 rounded-full border px-3 py-2 text-xs font-bold",
                  mode === o.v ? "border-[var(--accent-primary)] text-[var(--accent-primary)]" : "border-[var(--border-strong)] text-tertiary",
                )}
              >
                {o.l}
              </button>
            ))}
          </div>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date de début">
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full card px-3 py-3 text-sm text-primary outline-none"
          />
        </Field>
        <Field label="Date de fin">
          {hasEnd ? (
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full card px-3 py-3 text-sm text-primary outline-none"
            />
          ) : (
            <button
              onClick={() => setHasEnd(true)}
              className="w-full border border-dashed border-[var(--border-strong)] px-3 py-3 text-sm text-tertiary"
            >
              Sans fin · définir
            </button>
          )}
        </Field>
      </div>

      <button
        disabled={!canSave}
        onClick={save}
        className="flex w-full items-center justify-center gap-2 btn-primary py-3.5 text-sm font-bold text-[var(--on-accent)] disabled:opacity-40"
      >
        <Check size={18} /> Enregistrer {Number(amount) > 0 ? `${formatEur(Number(amount))}/échéance` : ""}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-tertiary">{label}</p>
      {children}
    </div>
  );
}
