"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { useDataStore } from "@/stores/data-store";
import { localToday } from "@/lib/utils/local-date";

export default function SaisieChevalPage() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <SaisieCheval />
      </Suspense>
    </ClientGate>
  );
}

function SaisieCheval() {
  const router = useRouter();
  const search = useSearchParams();
  const horses = useDataStore((s) => s.horses);
  const addHorse = useDataStore((s) => s.addHorse);
  const updateHorse = useDataStore((s) => s.updateHorse);

  // ?edit=<id> switches the form to edit mode, prefilled.
  const editId = search.get("edit");
  const editing = editId ? horses.find((h) => h.id === editId) : undefined;

  const [name, setName] = useState(editing?.name ?? "");
  const [breed, setBreed] = useState(editing?.breed ?? "");
  const [ownerName, setOwnerName] = useState(editing?.ownerName ?? "");
  const [pension, setPension] = useState(
    editing?.pension ? String(editing.pension) : "",
  );
  const [entryDate, setEntryDate] = useState(
    editing?.entryDate ?? localToday(),
  );
  const pensionNum = Number(pension.replace(",", ".")) || 0;

  function save() {
    if (!name.trim()) return;
    if (editing) {
      updateHorse(editing.id, {
        name: name.trim(),
        breed: breed.trim() || undefined,
        ownerName: ownerName.trim() || undefined,
        pension: pensionNum > 0 ? pensionNum : undefined,
        entryDate,
      });
      router.push(`/cheval?id=${editing.id}`);
      return;
    }
    // First horse → back to the home so the guided first-run steps continue.
    const isFirst = !horses.some((h) => !h.isArchived);
    addHorse({
      name: name.trim(),
      breed: breed.trim() || undefined,
      ownerName: ownerName.trim() || undefined,
      pension: pensionNum > 0 ? pensionNum : undefined,
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
        {editing ? `Modifier ${editing.name}` : "Ajouter un cheval"}
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
      <Field label="Pension (€/mois, optionnel)">
        <div className="flex items-center gap-1 rounded-[var(--radius-md)] border bg-elevated px-4 py-3">
          <input
            type="text"
            inputMode="decimal"
            value={pension}
            onChange={(e) => setPension(e.target.value.replace(/[^0-9,\.]/g, ""))}
            placeholder="450"
            className="w-full bg-transparent text-sm tabular-nums text-primary outline-none"
          />
          <span className="text-sm text-tertiary">€ / mois</span>
        </div>
        <p className="mt-1.5 text-[12px] text-tertiary">
          Postée automatiquement chaque mois en revenu. Une seule saisie, plus jamais
          de ligne « pension » à entrer.
        </p>
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
        className="flex w-full items-center justify-center gap-2 btn-primary py-3.5 text-[15px] font-bold text-[var(--on-accent)] disabled:opacity-40"
      >
        <Check size={18} /> {editing ? "Enregistrer les modifications" : "Ajouter ce cheval"}
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
