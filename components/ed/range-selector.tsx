"use client";

import { usePeriodStore } from "@/stores/period-store";
import { RANGE_PRESETS } from "@/lib/utils/period";
import { cn } from "@/lib/utils/cn";

/** Period range chips: Ce mois · 3 mois · Cette année · An dernier · 12 mois. */
export function RangeSelector() {
  const preset = usePeriodStore((s) => s.preset);
  const setPreset = usePeriodStore((s) => s.setPreset);

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
      {RANGE_PRESETS.map((r) => (
        <button
          key={r.value}
          onClick={() => setPreset(r.value)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-bold",
            preset === r.value
              ? "border-[var(--text-primary)] bg-[var(--ink)] text-[var(--on-ink)]"
              : "border-[var(--border-strong)] text-tertiary",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
