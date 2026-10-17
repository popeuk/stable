"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { LessonTerm } from "@/components/pedagogy/lesson-term";
import { CountUp, Hello, Ic, Money, Page, eur } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { useUiStore } from "@/stores/ui-store";
import { horsePnl, stablePnl } from "@/lib/domain/calculations";
import { simulateScenario, type ScenarioHorse } from "@/lib/domain/scenario";
import { formatPct } from "@/lib/utils/format-currency";

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
  const say = useUiStore((s) => s.say);

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
            // Les frais communs sont simulés à part (curseur) : ne pas les compter deux fois.
            variableCost: p.directCosts,
          };
        }),
    [data, period],
  );

  const baseStable = stablePnl(data, period);
  const baseFixed = Math.round(baseStable.sharedCosts);

  const [pensionAdjustment, setPensionAdjustment] = useState(0);
  const [fixedCosts, setFixedCosts] = useState(baseFixed);

  const results = simulateScenario({ pensionAdjustment, fixedCosts, useGlobalVariableCost: false }, baseHorses);

  const delta = results.monthlyResult - baseStable.netResult;
  const maxFixed = Math.max(10000, baseFixed * 2);

  return (
    <Page>
      <h1 className="ar-sr">Et si… ?</h1>
      <Hello title="Et si… ?" sub="Bouge les curseurs pour voir ce qu’il te resterait chaque mois. C’est un essai : tes vrais chiffres ne changent pas." />

      <div className="card ar-res rise" style={{ animationDelay: ".12s", margin: "14px 14px 0" }} aria-live="polite">
        <p className="k">Ce qu’il te resterait par mois</p>
        <p className={`big ${results.monthlyResult > 0 ? "in" : results.monthlyResult < 0 ? "out" : ""}`}>
          <CountUp value={results.monthlyResult} ms={500} />
        </p>
        <p className="ar-ecart">
          <Money v={delta} /> par rapport à aujourd’hui ({eur(baseStable.netResult)})
        </p>
        <div className="ar-two">
          <div>
            <small>
              <LessonTerm lessonKey="seuil_rentabilite">Minimum par place pour ne pas perdre</LessonTerm>
            </small>
            <b>{eur(results.breakEvenPerSlot)}</b>
          </div>
          <div>
            <small>Chevaux qui coûtent plus qu’ils ne rapportent</small>
            <b>
              {results.horsesUnderThreshold} sur {baseHorses.length}
            </b>
          </div>
        </div>
      </div>

      <div className="card rise" style={{ animationDelay: ".2s", margin: "10px 14px 0" }}>
        <Slider
          label="Changer toutes les pensions de"
          value={pensionAdjustment}
          min={-20}
          max={30}
          step={1}
          display={`${pensionAdjustment > 0 ? "+" : ""}${formatPct(pensionAdjustment)}`}
          ends={["−20 %", "0", "+30 %"]}
          onChange={setPensionAdjustment}
        />
        <Slider
          label="Frais de l’écurie par mois"
          hint="foin, paille, loyer, salaires…"
          value={fixedCosts}
          min={500}
          max={maxFixed}
          step={50}
          display={eur(fixedCosts)}
          ends={[eur(500), eur(maxFixed)]}
          onChange={setFixedCosts}
        />
      </div>

      <div className="pad rise" style={{ animationDelay: ".28s", marginTop: 12 }}>
        <button type="button" onClick={() => say("Essai gardé sur cet appareil.")} className="btn full">
          <Ic n="ck" className="" />
          Garder cet essai
        </button>
      </div>
      <div className="end" />
    </Page>
  );
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  display,
  ends,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  ends: string[];
  onChange: (v: number) => void;
}) {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <label className="ar-sld">
      <span className="ar-t">
        <span>
          {label}
          {hint && <small>{hint}</small>}
        </span>
        <b>{display}</b>
      </span>
      <input
        type="range"
        className="ar-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--p": `${p}%` } as CSSProperties}
      />
      <span className="ar-ends">
        {ends.map((e) => (
          <span key={e}>{e}</span>
        ))}
      </span>
    </label>
  );
}
