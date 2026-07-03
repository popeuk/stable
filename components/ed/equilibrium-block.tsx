"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Explain } from "@/components/ed/explain";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { equilibrium } from "@/lib/domain/equilibrium";
import { rangePeriods } from "@/lib/utils/period";
import { formatEur } from "@/lib/utils/format-currency";

/**
 * The break-even block: "are my charges covered, and if not, how many pensions
 * is the gap worth?" Profitability translated into the owner's own units —
 * the heart of the pedagogical promise.
 */
export function EquilibriumBlock() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const preset = usePeriodStore((s) => s.preset);
  const periods = useMemo(() => rangePeriods(active, preset), [active, preset]);
  const eq = useMemo(() => equilibrium(data, periods), [data, periods]);

  if (eq.monthlyCharges <= 0) return null;

  const covered = eq.coverage >= 1;
  const pct = Math.round(Math.min(1, eq.coverage) * 100);
  const barColor = covered
    ? "var(--c-success)"
    : eq.coverage >= 0.85
      ? "var(--c-warning)"
      : "var(--c-danger)";
  const pensions = eq.missingPensionEquiv.toLocaleString("fr-FR");

  return (
    <section className="border border-[var(--border-strong)] bg-elevated p-4">
      <div className="flex items-baseline justify-between">
        <Explain
          k="seuil_rentabilite"
          className="text-[12px] font-bold uppercase tracking-wide text-tertiary"
        >
          Ton point d&apos;équilibre
        </Explain>
        <span
          className="font-[family-name:var(--font-fraunces)] text-2xl tabular-nums"
          style={{ color: barColor }}
        >
          {pct} %
        </span>
      </div>

      {/* Charges as the track, revenue as the fill; the right edge is break-even. */}
      <div className="mt-2.5 h-2.5 w-full border border-[var(--border-strong)] bg-base">
        <motion.div
          className="h-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ background: barColor }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-tertiary">
        <span>0 €</span>
        <span>tes charges : {formatEur(eq.monthlyCharges)}/mois</span>
      </div>

      <p className="mt-2.5 text-[13px] leading-snug text-secondary">
        {covered ? (
          <>
            Tes charges sont couvertes : au-delà de ce point, chaque euro encaissé est de la
            marge.
          </>
        ) : eq.missingPensionEquiv > 0 ? (
          <>
            Il manque <strong className="text-primary">{formatEur(eq.monthlyGap)}/mois</strong>{" "}
            pour couvrir tes charges — l&apos;équivalent de{" "}
            <strong className="text-primary">
              {pensions} pension{eq.missingPensionEquiv >= 2 ? "s" : ""}
            </strong>
            .
          </>
        ) : (
          <>
            Il manque <strong className="text-primary">{formatEur(eq.monthlyGap)}/mois</strong>{" "}
            pour couvrir tes charges.
          </>
        )}
      </p>

      {eq.horseCount > 0 && eq.avgPension > 0 && (
        <p className="mt-2 border-t border-[var(--border-default)] pt-2 text-[12px] text-tertiary">
          En moyenne, un cheval te rapporte {formatEur(eq.avgPension)}/mois et te coûte{" "}
          {formatEur(eq.costPerHorse)} —{" "}
          <span
            className="font-bold"
            style={{
              color: eq.marginPerHorse >= 0 ? "var(--c-success)" : "var(--c-danger)",
            }}
          >
            {eq.marginPerHorse >= 0 ? "+" : ""}
            {formatEur(eq.marginPerHorse)} de marge par place occupée
          </span>
          .
        </p>
      )}
    </section>
  );
}
