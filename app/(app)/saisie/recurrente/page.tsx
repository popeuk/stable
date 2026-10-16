"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Explain } from "@/components/ed/explain";
import { HorseChips, InField } from "@/components/bs/seance-form";
import { Chips, Hello, Ic, Page, Seg, sg } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useFlashStore } from "@/stores/flash-store";
import type { DistributionMode, Frequency } from "@/lib/domain/types";
import { localToday } from "@/lib/utils/local-date";
import { montantOuZero, saisieMontant } from "@/lib/utils/montant";

export default function SaisieRecurrentePage() {
  return (
    <ClientGate>
      <SaisieRecurrente />
    </ClientGate>
  );
}

const FREQS: [Frequency, string][] = [
  ["monthly", "Chaque mois"],
  ["quarterly", "Chaque trimestre"],
  ["yearly", "Chaque année"],
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
  const [start, setStart] = useState(localToday());
  const [hasEnd, setHasEnd] = useState(false);
  const [end, setEnd] = useState("");

  const canSave = label.trim() && montantOuZero(amount) > 0 && (shared || horseId) && start && (!hasEnd || end);

  function save() {
    if (!canSave) return;
    useFlashStore.getState().setFlash({
      kind: "expense",
      amount: montantOuZero(amount),
      label: `${label.trim()} · comptée à chaque fois`,
    });
    addRecurring({
      label: label.trim(),
      amount: montantOuZero(amount),
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
    <Page className="nt-page">
      <Hello
        title="Une dépense qui revient"
        sub={
          <>
            Un crédit, un abonnement, l’assurance… Tu la notes une fois, elle est comptée toute seule à chaque fois, entre une <Explain k="depenses">date de début et une date de fin</Explain>.
          </>
        }
      />
      <div className="form nt-form rise" style={{ animationDelay: ".1s" }}>
        <div className="field">
          <span>Pour qui ?</span>
          <Seg
            label="Pour qui ?"
            value={shared ? "tous" : "un"}
            onChange={(v) => setShared(v === "tous")}
            options={[
              ["tous", "Toute l’écurie"],
              ["un", "Un cheval"],
            ]}
          />
        </div>

        {!shared && (
          <div className="field">
            <span>Quel cheval ?</span>
            <HorseChips horses={horses} value={horseId ? [horseId] : []} onChange={(ids) => setHorseId(ids[0] ?? null)} multi={false} wrap />
          </div>
        )}

        <label className="field">
          <span>C’est quoi ?</span>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Crédit matériel, abonnement…" />
        </label>

        <label className="field">
          <span>Combien à chaque fois ?</span>
          <InField unit="€" big>
            <input type="text" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(saisieMontant(e.target.value))} />
          </InField>
        </label>

        <div className="field">
          <span>Tous les combien ?</span>
          <Chips value={frequency} onChange={setFrequency} options={FREQS} />
        </div>

        <div className="field">
          <span>Dans quelle catégorie ?</span>
          <Chips value={categoryId ?? ""} onChange={setCategoryId} options={cats.map((c) => [c.id, c.name] as [string, string])} />
        </div>

        {shared && (
          <div className="field">
            <span>Comment la partager entre les chevaux ?</span>
            <Chips
              value={mode}
              onChange={setMode}
              options={[
                ["equal", "La même part pour chacun"],
                ["weighted_by_days", "Selon les jours passés chez toi"],
              ]}
            />
          </div>
        )}

        <div className="nt-two">
          <label className="field">
            <span>À partir du</span>
            <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
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

        <button type="button" className="btn full" disabled={!canSave} onClick={save}>
          <Ic n="ck" className="" />
          Enregistrer{montantOuZero(amount) > 0 ? ` · ${sg(-montantOuZero(amount))} à chaque fois` : ""}
        </button>
        <button type="button" className="btn ghost nt-cancel" onClick={() => router.back()}>
          Annuler
        </button>
      </div>
    </Page>
  );
}
