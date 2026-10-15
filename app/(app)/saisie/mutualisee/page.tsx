"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { LessonTerm } from "@/components/pedagogy/lesson-term";
import { HorseChips, InField } from "@/components/bs/seance-form";
import { Chips, Hello, Ic, Money, Page, sg } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useFlashStore } from "@/stores/flash-store";
import { usePeriodStore } from "@/stores/period-store";
import { distribute } from "@/lib/domain/distribution";
import type { DistributionMode } from "@/lib/domain/types";

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
  const [selected, setSelected] = useState<Set<string>>(() => new Set(horses.map((h) => h.id)));

  const selectedHorses = horses.filter((h) => selected.has(h.id));
  const totalNum = Number(total) || 0;

  const allocations = useMemo(() => distribute(totalNum, selectedHorses, mode, period), [totalNum, selectedHorses, mode, period]);

  const canSave = label.trim() && totalNum > 0 && selectedHorses.length > 0;

  const allSelected = selectedHorses.length === horses.length && horses.length > 0;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(horses.map((h) => h.id)));
  }

  function save() {
    if (!canSave) return;
    useFlashStore.getState().setFlash({
      kind: "expense",
      amount: totalNum,
      label: `${label.trim()} · partagé entre ${selectedHorses.length} chevaux`,
    });
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
    router.push("/accueil");
  }

  const nameOf = (id: string) => horses.find((h) => h.id === id)?.name ?? "";

  return (
    <Page className="nt-page">
      <Hello title={<LessonTerm lessonKey="charges_mutualisees">Frais communs</LessonTerm>} sub="Une dépense pour toute l’écurie (foin, paille, loyer, salaires…). On la partage entre les chevaux." />
      <div className="form nt-form rise" style={{ animationDelay: ".1s" }}>
        <label className="field">
          <span>C’est quoi ?</span>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Foin, granulés, salaire…" />
        </label>

        <label className="field">
          <span>Combien en tout ?</span>
          <InField unit="€" big>
            <input type="number" inputMode="decimal" placeholder="0" value={total} onChange={(e) => setTotal(e.target.value)} />
          </InField>
        </label>

        <div className="field">
          <span>Dans quelle catégorie ?</span>
          <Chips value={categoryId ?? ""} onChange={setCategoryId} options={sharedCats.map((c) => [c.id, c.name] as [string, string])} />
        </div>

        <div className="field">
          <span>Entre quels chevaux ?</span>
          <div className="chips">
            <button type="button" className={`chip${allSelected ? " on" : ""}`} aria-pressed={allSelected} onClick={toggleAll}>
              {allSelected ? "Aucun" : "Tous les chevaux"} · {selectedHorses.length}/{horses.length}
            </button>
          </div>
          <HorseChips horses={horses} value={[...selected]} onChange={(ids) => setSelected(new Set(ids))} wrap />
        </div>

        <div className="field">
          <span>Comment partager ?</span>
          <Chips
            value={mode}
            onChange={setMode}
            options={[
              ["equal", "La même part pour chacun"],
              ["weighted_by_days", "Selon les jours passés chez toi"],
            ]}
          />
          {mode === "weighted_by_days" && (
            <em>
              <LessonTerm lessonKey="repartition_jours">Un cheval arrivé en cours de mois paie moins : sa part dépend du nombre de jours passés chez toi ce mois.</LessonTerm>
            </em>
          )}
        </div>

        {/* Ce que chaque cheval paiera, en direct */}
        {totalNum > 0 && selectedHorses.length > 0 && (
          <div className="card">
            <p className="k">Ce que chaque cheval paiera</p>
            <div style={{ marginTop: 6 }}>
              {allocations.map((a) => (
                <div key={a.horseId} className="nt-alloc">
                  <span>
                    {nameOf(a.horseId)}
                    {a.presenceDays != null && <small>· {a.presenceDays} j</small>}
                  </span>
                  <Money v={-a.allocatedAmount} />
                </div>
              ))}
            </div>
          </div>
        )}

        <button type="button" className="btn full" disabled={!canSave} onClick={save}>
          <Ic n="ck" className="" />
          Enregistrer{totalNum > 0 ? ` · ${sg(-totalNum)}` : ""}
        </button>
        <button type="button" className="btn ghost nt-cancel" onClick={() => router.back()}>
          Annuler
        </button>
      </div>
    </Page>
  );
}
