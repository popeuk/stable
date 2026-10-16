"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { HorseChips, InField, NoHorse } from "@/components/bs/seance-form";
import { Chips, Hello, Ic, Page, Seg, sg } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useFlashStore } from "@/stores/flash-store";
import type { Frequency } from "@/lib/domain/types";
import { localToday } from "@/lib/utils/local-date";
import { montantOuZero, saisieMontant } from "@/lib/utils/montant";

const FREQS: [Frequency, string][] = [
  ["monthly", "Chaque mois"],
  ["quarterly", "Chaque trimestre"],
  ["yearly", "Chaque année"],
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
  const [horseId, setHorseId] = useState<string | null>(presetHorse && horses.some((h) => h.id === presetHorse) ? presetHorse : null);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(directCats[0]?.id);
  const [date, setDate] = useState(localToday());
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [hasEnd, setHasEnd] = useState(false);
  const [end, setEnd] = useState("");

  const canSave = horseId && montantOuZero(amount) > 0 && label.trim() && (!recurring || (date && (!hasEnd || end)));

  function save() {
    if (!canSave) return;
    const horseName = horses.find((h) => h.id === horseId)?.name ?? "";
    useFlashStore.getState().setFlash({
      kind: "expense",
      amount: montantOuZero(amount),
      label: `${label.trim()}${horseName ? ` · ${horseName}` : ""}`,
    });
    if (recurring) {
      addRecurringExpense({
        label: label.trim(),
        amount: montantOuZero(amount),
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
        amount: montantOuZero(amount),
        date,
        source: photoMode ? "photo" : "manual",
      });
    }
    router.push("/accueil");
  }

  return (
    <Page className="nt-page">
      <Hello title="Noter une dépense" sub="Une dépense pour un cheval précis : maréchal, véto, complément…" />
      <div className="form nt-form rise" style={{ animationDelay: ".1s" }}>
        <Seg
          label="Une fois ou souvent ?"
          value={recurring ? "oui" : "non"}
          onChange={(v) => setRecurring(v === "oui")}
          options={[
            ["non", "Une seule fois"],
            ["oui", "Revient souvent"],
          ]}
        />

        {photoMode && (
          <button
            type="button"
            className="btn line full"
            onClick={() => {
              // Demo: simulate an OCR result.
              setLabel("Maréchal-ferrant");
              setAmount("120");
            }}
          >
            <Ic n="camera" className="" />
            Remplir avec un exemple (démo, sans vraie photo)
          </button>
        )}

        <div className="field">
          <span>Quel cheval ?</span>
          {horses.length === 0 ? (
            <NoHorse text="Ajoute d’abord un cheval pour lui noter cette dépense." />
          ) : (
            <HorseChips horses={horses} value={horseId ? [horseId] : []} onChange={(ids) => setHorseId(ids[0] ?? null)} multi={false} wrap />
          )}
        </div>

        <label className="field">
          <span>C’est quoi ?</span>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Maréchal, véto…" />
        </label>

        <label className="field">
          <span>Combien ?</span>
          <InField unit="€" big>
            <input type="text" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(saisieMontant(e.target.value))} />
          </InField>
        </label>

        <div className="field">
          <span>Dans quelle catégorie ?</span>
          <Chips value={categoryId ?? ""} onChange={setCategoryId} options={directCats.map((c) => [c.id, c.name] as [string, string])} />
        </div>

        {recurring && (
          <div className="field">
            <span>Tous les combien ?</span>
            <Chips value={frequency} onChange={setFrequency} options={FREQS} />
          </div>
        )}

        {recurring ? (
          <div className="nt-two">
            <label className="field">
              <span>À partir du</span>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <div className="field">
              <span>Jusqu’au</span>
              {hasEnd ? (
                <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Jusqu’au" />
              ) : (
                <button type="button" className="btn line nt-noend" onClick={() => setHasEnd(true)}>
                  Pas de fin · ajouter une date
                </button>
              )}
            </div>
          </div>
        ) : (
          <label className="field">
            <span>Date</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}

        <button type="button" className="btn full" disabled={!canSave} onClick={save}>
          <Ic n="ck" className="" />
          Enregistrer{montantOuZero(amount) > 0 ? ` · ${sg(-montantOuZero(amount))}${recurring ? " à chaque fois" : ""}` : ""}
        </button>
        <button type="button" className="btn ghost nt-cancel" onClick={() => router.back()}>
          Annuler
        </button>
      </div>
    </Page>
  );
}
