"use client";

import { useMemo } from "react";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { stablePnl } from "@/lib/domain/calculations";
import {
  lastNPeriods,
  periodKey,
  samePeriod,
  currentPeriod,
  rangePeriods,
} from "@/lib/utils/period";
import { formatShortMonth, formatMonthName } from "@/lib/utils/format-date";
import { Horseshoe } from "@/components/ed/atoms";

/**
 * The Time Ribbon (editorial). Bar height = net result. It now reflects the
 * active range: every month inside the chosen period is highlighted, the rest
 * dimmed, with a caption naming the range. Tapping a bar focuses that month.
 */
export function PeriodStrip() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const preset = usePeriodStore((s) => s.preset);
  const setActive = usePeriodStore((s) => s.setActive);
  const now = currentPeriod();

  // Window the ribbon shows, adapted to the range so it always makes sense.
  const windowEnd =
    preset === "last_year"
      ? { year: now.year - 1, month: 12 }
      : preset === "month"
        ? active
        : now;

  const { bars, rangeKeys, caption } = useMemo(() => {
    const periods = lastNPeriods(windowEnd, 12);
    const values = periods.map((p) => stablePnl(data, p).netResult);
    const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)));
    const range = rangePeriods(active, preset, now);
    const keys = new Set(range.map(periodKey));

    const first = range[0];
    const last = range[range.length - 1];
    const cap =
      range.length === 1
        ? `${formatMonthName(first)} ${first.year}`
        : first.year === last.year
          ? `${formatShortMonth(first)} – ${formatShortMonth(last)} ${last.year}`
          : `${formatShortMonth(first)} ${first.year} – ${formatShortMonth(last)} ${last.year}`;

    return {
      bars: periods.map((p, i) => ({ period: p, value: values[i], ratio: Math.abs(values[i]) / maxAbs })),
      rangeKeys: keys,
      caption: cap,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data.revenues,
    data.directExpenses,
    data.sharedExpenses,
    data.recurringExpenses,
    data.recurringRevenues,
    active,
    preset,
    windowEnd.year,
    windowEnd.month,
  ]);

  return (
    <div className="sticky top-0 z-30 border-b border-[var(--border-default)] bg-base/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[440px] items-center gap-2 px-4 pb-1 pt-2">
        <Horseshoe size={16} stroke={2} />
        <div className="flex flex-1 items-end justify-between gap-[3px]">
          {bars.map((bar) => {
            const key = periodKey(bar.period);
            const inRange = rangeKeys.has(key);
            const isFocus = preset === "month" && samePeriod(bar.period, active);
            const positive = bar.value >= 0;
            return (
              <button
                key={key}
                onClick={() => setActive(bar.period)}
                className="flex flex-1 flex-col items-center gap-1"
                aria-label={`${formatShortMonth(bar.period)} ${bar.period.year}`}
              >
                <span className="flex h-6 w-full items-end justify-center">
                  <span
                    className="w-full transition-all duration-300"
                    style={{
                      height: `${Math.max(10, bar.ratio * 100)}%`,
                      background: isFocus
                        ? "var(--text-primary)"
                        : positive
                          ? "var(--c-success)"
                          : "var(--c-danger)",
                      opacity: isFocus ? 1 : inRange ? 0.9 : 0.18,
                    }}
                  />
                </span>
                {/* Range underline so the span reads at a glance */}
                <span
                  className="h-[2px] w-full transition-colors"
                  style={{ background: inRange ? "var(--text-primary)" : "transparent" }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="mx-auto max-w-[440px] px-4 pb-1.5 pl-[34px]">
        <span className="text-[11px] font-semibold capitalize text-tertiary">{caption}</span>
      </div>
    </div>
  );
}
