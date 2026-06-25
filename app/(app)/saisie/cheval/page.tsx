"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { useDataStore } from "@/stores/data-store";

export default function SaisieChevalPage() {
  return (
    <ClientGate>
      <SaisieCheval />
    </ClientGate>
  );
}

function SaisieCheval() {
  const router = useRouter();
  const horses = useDataStore((s) => s.horses);
  const addHorse = useDataStore((s) => s.addHorse);
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));

  function save() {
    if (!name.trim()) return;
    // First horse → back to the home so the guided first-run steps continue.
    const isFirst = !horses.some((h) => !h.isArchived);
    addHorse({
      name: name.trim(),
      breed: breed.trim() || undefined,
      ownerName: ownerName.trim() || undefined,
      entryDate,
      exitDate: null,
    });
    router.push(isFirst ? "/maintenant" : "/ecurie");
  }

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-tertiary">
        <ChevronLeft size={16} /> Annuler
      </button>
      <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">
        Ajouter un cheval
      </h1>

      <Field label="Nom">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Belle"
          className="w-full rounded-[var(--radius-md)] border bg-elevated px-4 py-3 text-sm text-primary outline-none"
        />
      </Field>
      <Field label="Race (optionnel)">
        <input
          value={breed}
          onChange={(e) => setBreed(e.target.value)}
          placeholder="Connemara"
          className="w-full rounded-[var(--radius-md)] border bg-elevated px-4 py-3 text-sm text-primary outline-none"
        />
      </Field>
      <Field label="Propriétaire (optionnel)">
        <input
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          className="w-full rounded-[var(--radius-md)] border bg-elevated px-4 py-3 text-sm text-primary outline-none"
        />
      </Field>
      <Field label="Date d'entrée">
        <input
          type="date"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
          className="w-full rounded-[var(--radius-md)] border bg-elevated px-4 py-3 text-sm text-primary outline-none"
        />
      </Field>

      <button
        disabled={!name.trim()}
        onClick={save}
        className="flex w-full items-center justify-center gap-2 border border-[var(--text-primary)] bg-[var(--accent-primary)] py-3.5 text-[15px] font-bold text-[#17150d] disabled:opacity-40"
      >
        <Check size={18} /> Ajouter ce cheval
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
