"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { generateInsights } from "@/lib/domain/insights-engine";
import { SectionHead } from "@/components/ed/atoms";

function eur(n: number) {
  const v = new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n)));
  return `${n < 0 ? "−" : ""}${v} €`;
}

/** Horizontal carousel of weekly discoveries, surfaced right on the home. */
export function InsightsCarousel() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const insights = generateInsights(data, active).slice(0, 5);

  if (insights.length === 0) return null;

  return (
    <section>
      <SectionHead title="Découvertes" action={<Link href="/decouvertes">Tout voir ›</Link>} />
      <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
        {insights.map((insight) => (
          <Link
            key={insight.id}
            href={
              insight.relatedHorseId
                ? `/cheval?id=${insight.relatedHorseId}`
                : `/decouvertes/detail?id=${encodeURIComponent(insight.id)}`
            }
            className="flex w-[260px] shrink-0 snap-start flex-col justify-between border border-[var(--border-strong)] bg-elevated p-4"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <p className="text-[15px] font-bold leading-tight text-primary">{insight.title}</p>
                <ArrowUpRight size={16} className="mt-0.5 shrink-0 text-tertiary" />
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-secondary line-clamp-3">
                {insight.body}
              </p>
            </div>
            <p
              className="mt-3 text-[20px] font-extrabold tabular-nums"
              style={{ color: insight.keyMetricValue >= 0 ? "var(--c-success)" : "var(--c-danger)" }}
            >
              {eur(insight.keyMetricValue)}
              <span className="ml-1 text-[11px] font-semibold text-tertiary">
                {insight.keyMetricLabel}
              </span>
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
