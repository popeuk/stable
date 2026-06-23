"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { HorseAvatar } from "@/components/horse/horse-avatar";
import { useDataStore } from "@/stores/data-store";
import { cn } from "@/lib/utils/cn";
import { formatEur } from "@/lib/utils/format-currency";

export default function SaisieRevenuPage() {
  return (
    <ClientGate>
      <SaisieRevenu />
    </ClientGate>
  );
}

function SaisieRevenu() {
  const router = useRouter();
  const data = useDataStore();
  const addRevenue = useDataStore((s) => s.addRevenue);

  const horses = data.horses.filter((h) => !h.isArchived);
  const [horseId, setHorseId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(data.revenueCategories[0]?.id);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const canSave = horseId && Number(amount) > 0;

  function save() {
    if (!canSave) return;
    addRevenue({
      horseId: horseId!,
      categoryId,
      amount: Number(amount),
      date,
      source: "manual",
    });
    router.push("/maintenant");
  }

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-tertiary">
        <ChevronLeft size={16} /> Annuler
      </button>
      <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">
        Encaisser un revenu
      </h1>

      <Field label="Quel cheval ?">
        <div className="grid grid-cols-4 gap-2">
          {horses.map((h) => (
            <button
              key={h.id}
              onClick={() => setHorseId(h.id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-[var(--radius-md)] border p-2",
                horseId === h.id ? "border-[var(--accent-primary)] bg-[var(--accent-primary-soft)]" : "",
              )}
            >
              <HorseAvatar name={h.name} size={36} />
              <span className="truncate text-[10px] text-secondary">{h.name}</span>
            </button>
          ))}
        </div>
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

      <Field label="Type">
        <div className="flex flex-wrap gap-2">
          {data.revenueCategories.map((c) => (
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

      <Field label="Date">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-[var(--radius-md)] border bg-elevated px-4 py-3 text-sm text-primary outline-none"
        />
      </Field>

      <button
        disabled={!canSave}
        onClick={save}
        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] py-3.5 text-sm font-medium text-[#0e0f0c] disabled:opacity-40"
        style={{ background: "var(--accent-primary)" }}
      >
        <Check size={18} /> Enregistrer {Number(amount) > 0 ? formatEur(Number(amount)) : ""}
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
