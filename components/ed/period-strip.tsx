"use client";

import { useMemo } from "react";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { stablePnl } from "@/lib/domain/calculations";
import { lastNPeriods, periodKey, samePeriod, currentPeriod } from "@/lib/utils/period";
import { formatShortMonth } from "@/lib/utils/format-date";
import { Horseshoe } from "@/components/ed/atoms";

/**
 * Fine 12-month period strip (the Time Ribbon, editorial). Bar height = net
 * result; tap a month to scope the whole app to it.
 */
export function PeriodStrip() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const setActive = usePeriodStore((s) => s.setActive);
  const now = currentPeriod();

  const bars = useMemo(() => {
    const periods = lastNPeriods(now, 12);
    const values = periods.map((p) => stablePnl(data, p).netResult);
    const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)));
    return periods.map((p, i) => ({ period: p, value: values[i], ratio: Math.abs(values[i]) / maxAbs }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.revenues, data.directExpenses, data.sharedExpenses, now.year, now.month]);

  return (
    <div className="sticky top-0 z-30 border-b border-[var(--border-default)] bg-base/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[440px] items-center gap-2 px-4 py-2">
        <Horseshoe size={16} stroke={2} />
        <div className="flex flex-1 items-end justify-between gap-[3px]">
          {bars.map((bar) => {
            const isActive = samePeriod(bar.period, active);
            const positive = bar.value >= 0;
            return (
              <button
                key={periodKey(bar.period)}
                onClick={() => setActive(bar.period)}
                className="flex flex-1 flex-col items-center gap-1"
                aria-label={`${formatShortMonth(bar.period)} ${bar.period.year}`}
              >
                <span className="flex h-6 w-full items-end justify-center">
                  <span
                    className="w-full"
                    style={{
                      height: `${Math.max(10, bar.ratio * 100)}%`,
                      background: isActive
                        ? "var(--text-primary)"
                        : positive
                          ? "var(--c-success)"
                          : "var(--c-danger)",
                      opacity: isActive ? 1 : 0.32,
                    }}
                  />
                </span>
                <span
                  className="text-[8px] uppercase leading-none"
                  style={{ color: isActive ? "var(--text-primary)" : "var(--text-tertiary)" }}
                >
                  {formatShortMonth(bar.period).slice(0, 1)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
