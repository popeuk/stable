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

const FREQS: [Frequency, string][] = [
  ["monthly", "Chaque mois"],
  ["quarterly", "Chaque trimestre"],
  ["yearly", "Chaque année"],
];

export default function SaisieRevenuPage() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <SaisieRevenu />
      </Suspense>
    </ClientGate>
  );
}

function SaisieRevenu() {
  const router = useRouter();
  const search = useSearchParams();
  const data = useDataStore();
  const addRevenue = useDataStore((s) => s.addRevenue);
  const addRecurringRevenue = useDataStore((s) => s.addRecurringRevenue);

  const horses = data.horses.filter((h) => !h.isArchived);
  const presetHorse = search.get("horse");
  const [horseId, setHorseId] = useState<string | null>(presetHorse && horses.some((h) => h.id === presetHorse) ? presetHorse : null);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(data.revenueCategories[0]?.id);
  const [date, setDate] = useState(localToday());
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [hasEnd, setHasEnd] = useState(false);
  const [end, setEnd] = useState("");

  const canSave = horseId && Number(amount) > 0 && (!recurring || (date && (!hasEnd || end)));

  function save() {
    if (!canSave) return;
    const horseName = horses.find((h) => h.id === horseId)?.name ?? "";
    const catName = data.revenueCategories.find((c) => c.id === categoryId)?.name ?? "Revenu";
    useFlashStore.getState().setFlash({
      kind: "revenue",
      amount: Number(amount),
      label: `${catName}${horseName ? ` · ${horseName}` : ""}`,
    });
    if (recurring) {
      addRecurringRevenue({
        horseId: horseId!,
        categoryId,
        amount: Number(amount),
        frequency,
        startDate: date,
        endDate: hasEnd ? end : null,
        source: "recurring",
      });
    } else {
      addRevenue({
        horseId: horseId!,
        categoryId,
        amount: Number(amount),
        date,
        source: "manual",
      });
    }
    router.push("/accueil");
  }

  return (
    <Page className="nt-page">
      <Hello title="Noter ce qui rentre" />
      <div className="form nt-form rise" style={{ animationDelay: ".1s" }}>
        {/* Ponctuel ou récurrent (une pension est récurrente) */}
        <div className="field">
          <Seg
            label="Une fois ou souvent ?"
            value={recurring ? "oui" : "non"}
            onChange={(v) => setRecurring(v === "oui")}
            options={[
              ["non", "Une seule fois"],
              ["oui", "Revient souvent"],
            ]}
          />
          {recurring && <em>Parfait pour une pension : elle est comptée toute seule à chaque fois, tu n’as plus à la noter.</em>}
        </div>

        <div className="field">
          <span>Quel cheval ?</span>
          {horses.length === 0 ? (
            <NoHorse text="Ajoute d’abord un cheval pour noter ce qu’il te rapporte." />
          ) : (
            <HorseChips horses={horses} value={horseId ? [horseId] : []} onChange={(ids) => setHorseId(ids[0] ?? null)} multi={false} wrap />
          )}
        </div>

        <label className="field">
          <span>Combien ?</span>
          <InField unit="€" big>
            <input type="number" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </InField>
        </label>

        <div className="field">
          <span>C’est quoi ?</span>
          <Chips value={categoryId ?? ""} onChange={setCategoryId} options={data.revenueCategories.map((c) => [c.id, c.name] as [string, string])} />
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
          Enregistrer{Number(amount) > 0 ? ` · ${sg(Number(amount))}${recurring ? " à chaque fois" : ""}` : ""}
        </button>
        <button type="button" className="btn ghost nt-cancel" onClick={() => router.back()}>
          Annuler
        </button>
      </div>
    </Page>
  );
}
