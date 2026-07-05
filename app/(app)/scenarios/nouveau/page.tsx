"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { KeyNumber } from "@/components/ui/key-number";
import { LessonTerm } from "@/components/pedagogy/lesson-term";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { horsePnl, stablePnl } from "@/lib/domain/calculations";
import { simulateScenario, type ScenarioHorse } from "@/lib/domain/scenario";
import { formatEur, formatPct } from "@/lib/utils/format-currency";

export default function NouveauScenarioPage() {
  return (
    <ClientGate>
      <Simulator />
    </ClientGate>
  );
}

function Simulator() {
  const data = useDataStore();
  const period = usePeriodStore((s) => s.active);

  // Derive each horse's base pension & variable cost from the active month.
  const baseHorses: ScenarioHorse[] = useMemo(
    () =>
      data.horses
        .filter((h) => !h.isArchived)
        .map((h) => {
          const p = horsePnl(data, h.id, period);
          return {
            id: h.id,
            name: h.name,
            pension: p.revenue,
            variableCost: p.directCosts + p.sharedCosts,
          };
        }),
    [data, period],
  );

  const baseStable = stablePnl(data, period);
  const baseFixed = Math.round(baseStable.sharedCosts);

  const [pensionAdjustment, setPensionAdjustment] = useState(0);
  const [fixedCosts, setFixedCosts] = useState(baseFixed);

  const results = simulateScenario(
    { pensionAdjustment, fixedCosts, useGlobalVariableCost: false },
    baseHorses,
  );

  const delta = results.monthlyResult - baseStable.netResult;

  return (
    <div className="space-y-6">
      <Link href="/maintenant" className="inline-flex items-center gap-1 text-sm text-tertiary">
        <ChevronLeft size={16} /> Retour
      </Link>

      <header>
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">
          Tester un scénario
        </h1>
        <p className="text-sm text-tertiary">
          Déplace les curseurs, le résultat se recalcule en direct.
        </p>
      </header>

      {/* Live projection */}
      <section className="rounded-[var(--radius-lg)] border bg-elevated p-5">
        <p className="text-2xs uppercase tracking-wide text-tertiary">Résultat mensuel projeté</p>
        <KeyNumber value={results.monthlyResult} colorBySign className="text-4xl" animateOnMount={false} />
        <p className="mt-1 text-sm" style={{ color: delta >= 0 ? "var(--c-success)" : "var(--c-danger)" }}>
          {delta >= 0 ? "+" : ""}
          {formatEur(delta)} vs actuel ({formatEur(baseStable.netResult)})
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-center">
          <div>
            <LessonTerm lessonKey="seuil_rentabilite" className="text-2xs uppercase text-tertiary">
              Seuil / place
            </LessonTerm>
            <p className="tabnums mt-1 text-lg text-primary">{formatEur(results.breakEvenPerSlot)}</p>
          </div>
          <div>
            <p className="text-2xs uppercase text-tertiary">Chevaux sous seuil</p>
            <p className="tabnums mt-1 text-lg" style={{ color: results.horsesUnderThreshold > 0 ? "var(--c-danger)" : "var(--c-success)" }}>
              {results.horsesUnderThreshold} / {baseHorses.length}
            </p>
          </div>
        </div>
      </section>

      {/* Sliders */}
      <section className="space-y-6 rounded-[var(--radius-lg)] border bg-elevated p-5">
        <Slider
          label="Ajustement global des pensions"
          value={pensionAdjustment}
          min={-20}
          max={30}
          step={1}
          display={`${pensionAdjustment > 0 ? "+" : ""}${formatPct(pensionAdjustment)}`}
          onChange={setPensionAdjustment}
        />
        <Slider
          label="Charges fixes globales"
          value={fixedCosts}
          min={500}
          max={Math.max(10000, baseFixed * 2)}
          step={50}
          display={formatEur(fixedCosts)}
          onChange={setFixedCosts}
        />
      </section>

      <button
        onClick={() => alert("Scénario sauvegardé (démo locale).")}
        className="w-full btn-primary py-3.5 text-[15px] font-bold text-[var(--on-accent)]"
      >
        Sauvegarder ce scénario
      </button>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-secondary">{label}</span>
        <span className="tabnums text-sm font-medium text-[var(--accent-primary)]">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent-primary)]"
        style={{ height: 28 }}
      />
    </div>
  );
}
