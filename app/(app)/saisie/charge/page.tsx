"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronLeft, Camera, ArrowRight } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { HorseAvatar } from "@/components/horse/horse-avatar";
import { useDataStore } from "@/stores/data-store";
import type { Frequency } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { formatEur } from "@/lib/utils/format-currency";

const FREQS: { v: Frequency; l: string }[] = [
  { v: "monthly", l: "Mensuel" },
  { v: "quarterly", l: "Trimestriel" },
  { v: "yearly", l: "Annuel" },
];

export default function SaisieChargePage() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <SaisieCharge />
      </Suspense>
    </ClientGate>
  );
}

function SaisieCharge() {
  const router = useRouter();
  const search = useSearchParams();
  const photoMode = search.get("mode") === "photo";
  const data = useDataStore();
  const addDirectExpense = useDataStore((s) => s.addDirectExpense);
  const addRecurringExpense = useDataStore((s) => s.addRecurringExpense);

  const horses = data.horses.filter((h) => !h.isArchived);
  const directCats = data.expenseCategories.filter((c) => c.isDirect);
  const presetHorse = search.get("horse");
  const [horseId, setHorseId] = useState<string | null>(
    presetHorse && horses.some((h) => h.id === presetHorse) ? presetHorse : null,
  );
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(directCats[0]?.id);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [hasEnd, setHasEnd] = useState(false);
  const [end, setEnd] = useState("");

  const canSave =
    horseId && Number(amount) > 0 && label.trim() && (!recurring || (date && (!hasEnd || end)));

  function save() {
    if (!canSave) return;
    if (recurring) {
      addRecurringExpense({
        label: label.trim(),
        amount: Number(amount),
        categoryId,
        isShared: false,
        horseId: horseId!,
        frequency,
        startDate: date,
        endDate: hasEnd ? end : null,
        source: "manual",
      });
    } else {
      addDirectExpense({
        horseId: horseId!,
        categoryId,
        label: label.trim(),
        amount: Number(amount),
        date,
        source: photoMode ? "photo" : "manual",
      });
    }
    router.push("/maintenant");
  }

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-tertiary">
        <ChevronLeft size={16} /> Annuler
      </button>
      <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">
        Saisir une charge
      </h1>

      <div className="grid grid-cols-2 border border-[var(--border-strong)]">
        {[
          { v: false, l: "Ponctuelle" },
          { v: true, l: "Récurrente" },
        ].map((o) => (
          <button
            key={String(o.v)}
            onClick={() => setRecurring(o.v)}
            className="py-2.5 text-[14px] font-bold"
            style={{
              background: recurring === o.v ? "var(--text-primary)" : "transparent",
              color: recurring === o.v ? "var(--bg-base)" : "var(--text-primary)",
            }}
          >
            {o.l}
          </button>
        ))}
      </div>

      {photoMode && (
        <button
          onClick={() => {
            // Demo: simulate an OCR result.
            setLabel("Maréchal-ferrant");
            setAmount("120");
          }}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed py-6 text-sm text-secondary"
        >
          <Camera size={20} /> Prendre la facture en photo (démo OCR)
        </button>
      )}

      <Field label="Quel cheval ?">
        {horses.length === 0 ? (
          <Link
            href="/saisie/cheval"
            className="flex items-center justify-between border border-dashed border-[var(--border-strong)] px-4 py-3.5"
          >
            <span className="pr-3 text-[13px] text-secondary">
              Ajoute d&apos;abord un cheval pour lui attribuer cette charge.
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[13px] font-bold text-[var(--accent-primary)]">
              Ajouter <ArrowRight size={14} />
            </span>
          </Link>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {horses.map((h) => (
              <button
                key={h.id}
                onClick={() => setHorseId(h.id)}
                className={cn(
                  "flex flex-col items-center gap-1 border p-2",
                  horseId === h.id
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary-soft)]"
                    : "border-[var(--border-default)]",
                )}
              >
                <HorseAvatar name={h.name} size={36} />
                <span className="truncate text-[10px] text-secondary">{h.name}</span>
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field label="Libellé">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Maréchal, véto…"
          className="w-full rounded-[var(--radius-md)] border bg-elevated px-4 py-3 text-sm text-primary outline-none"
        />
      </Field>

      <Field label="Combien ?">
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border bg-elevated px-4 py-3">
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-transparent text-2xl tabnums text-primary outline-none"
          />
          <span className="text-xl text-tertiary">€</span>
        </div>
      </Field>

      <Field label="Catégorie">
        <div className="flex flex-wrap gap-2">
          {directCats.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              className={cn(
                "border px-3 py-1.5 text-xs font-semibold",
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

      {recurring && (
        <Field label="Fréquence">
          <div className="flex gap-2">
            {FREQS.map((f) => (
              <button
                key={f.v}
                onClick={() => setFrequency(f.v)}
                className={cn(
                  "flex-1 rounded-[var(--radius-md)] border px-2 py-2 text-xs font-bold",
                  frequency === f.v ? "border-[var(--accent-primary)] text-[var(--accent-primary)]" : "text-tertiary",
                )}
              >
                {f.l}
              </button>
            ))}
          </div>
        </Field>
      )}

      {recurring ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date de début">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border bg-elevated px-3 py-3 text-sm text-primary outline-none"
            />
          </Field>
          <Field label="Date de fin">
            {hasEnd ? (
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-[var(--radius-md)] border bg-elevated px-3 py-3 text-sm text-primary outline-none"
              />
            ) : (
              <button
                onClick={() => setHasEnd(true)}
                className="w-full rounded-[var(--radius-md)] border border-dashed px-3 py-3 text-sm text-tertiary"
              >
                Sans fin · définir
              </button>
            )}
          </Field>
        </div>
      ) : (
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-[var(--radius-md)] border bg-elevated px-4 py-3 text-sm text-primary outline-none"
          />
        </Field>
      )}

      <button
        disabled={!canSave}
        onClick={save}
        className="flex w-full items-center justify-center gap-2 border border-[var(--text-primary)] bg-[var(--accent-primary)] py-3.5 text-[15px] font-bold text-[#17150d] disabled:opacity-40"
      >
        <Check size={18} /> Enregistrer{" "}
        {Number(amount) > 0 ? `${formatEur(Number(amount))}${recurring ? "/échéance" : ""}` : ""}
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
