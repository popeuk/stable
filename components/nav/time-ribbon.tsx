"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { stablePnl } from "@/lib/domain/calculations";
import { lastNPeriods, periodKey, samePeriod, currentPeriod } from "@/lib/utils/period";
import { formatShortMonth } from "@/lib/utils/format-date";
import { formatEurCompact } from "@/lib/utils/format-currency";
import { SyncIndicator } from "@/components/ui/sync-indicator";

/**
 * The persistent Time Ribbon (section 6.1.A). Twelve mini-bars, one per
 * month, height encodes the stable's net result. Tapping a bar sets the
 * active period for the whole app.
 */
export function TimeRibbon() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const setActive = usePeriodStore((s) => s.setActive);
  const now = currentPeriod();

  const bars = useMemo(() => {
    const periods = lastNPeriods(now, 12);
    const values = periods.map((p) => stablePnl(data, p).netResult);
    const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)));
    return periods.map((p, i) => ({
      period: p,
      value: values[i],
      ratio: Math.abs(values[i]) / maxAbs,
    }));
    // Recompute when the underlying data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.revenues, data.directExpenses, data.sharedExpenses, now.year, now.month]);

  const activeBar = bars.find((b) => samePeriod(b.period, active));

  return (
    <div className="sticky top-0 z-30 border-b bg-[var(--bg-base)]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[480px] items-end justify-between gap-[3px] px-4 pb-2 pt-3">
        {bars.map((bar) => {
          const isActive = samePeriod(bar.period, active);
          const positive = bar.value >= 0;
          return (
            <button
              key={periodKey(bar.period)}
              onClick={() => setActive(bar.period)}
              className="group flex flex-1 flex-col items-center gap-1"
              aria-label={`${formatShortMonth(bar.period)} : ${formatEurCompact(bar.value)}`}
            >
              <div className="flex h-9 w-full items-end justify-center">
                <motion.span
                  layout
                  className="w-full rounded-sm"
                  style={{
                    height: `${Math.max(8, bar.ratio * 100)}%`,
                    backgroundColor: isActive
                      ? "var(--accent-primary)"
                      : positive
                        ? "var(--c-success)"
                        : "var(--c-danger)",
                    opacity: isActive ? 1 : 0.35,
                  }}
                />
              </div>
              <span
                className="text-[9px] uppercase leading-none"
                style={{
                  color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
                }}
              >
                {formatShortMonth(bar.period).slice(0, 1)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mx-auto flex max-w-[480px] items-center justify-between px-4 pb-2">
        <span className="text-2xs capitalize text-tertiary">
          {formatShortMonth(active)} {active.year} ·{" "}
          <span className="tabnums" style={{ color: (activeBar?.value ?? 0) >= 0 ? "var(--c-success)" : "var(--c-danger)" }}>
            {formatEurCompact(activeBar?.value ?? 0)}
          </span>
        </span>
        <SyncIndicator />
      </div>
    </div>
  );
}
