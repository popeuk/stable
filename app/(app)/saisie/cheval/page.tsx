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
  const addHorse = useDataStore((s) => s.addHorse);
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));

  function save() {
    if (!name.trim()) return;
    addHorse({
      name: name.trim(),
      breed: breed.trim() || undefined,
      ownerName: ownerName.trim() || undefined,
      entryDate,
      exitDate: null,
    });
    router.push("/ecurie");
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
        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] py-3.5 text-sm font-medium text-[#0e0f0c] disabled:opacity-40"
        style={{ background: "var(--accent-primary)" }}
      >
        <Check size={18} /> Ajouter
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
