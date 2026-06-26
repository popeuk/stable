"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { KeyNumber } from "@/components/ui/key-number";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { generateInsights } from "@/lib/domain/insights-engine";

export function InsightView({ id }: { id: string }) {
  return (
    <ClientGate>
      <InsightDetail id={id} />
    </ClientGate>
  );
}

function InsightDetail({ id }: { id: string }) {
  const data = useDataStore();
  const period = usePeriodStore((s) => s.active);
  const insight = generateInsights(data, period).find((i) => i.id === id);

  if (!insight) {
    return (
      <div className="space-y-4">
        <Link href="/decouvertes" className="inline-flex items-center gap-1 text-sm text-tertiary">
          <ChevronLeft size={16} /> Découvertes
        </Link>
        <p className="text-secondary">Cette découverte n&apos;est plus d&apos;actualité.</p>
      </div>
    );
  }

  const stagger = (i: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <div className="relative min-h-[70vh] overflow-hidden rounded-[var(--radius-xl)] border bg-gradient-to-br from-[var(--accent-primary-soft)] via-transparent to-[rgba(124,144,112,0.12)] p-6">
      <Link href="/decouvertes" className="inline-flex items-center gap-1 text-sm text-tertiary">
        <ChevronLeft size={16} /> Découvertes
      </Link>

      <motion.p {...stagger(0)} className="mt-8 text-2xs uppercase tracking-wide text-[var(--accent-primary)]">
        Découverte de la semaine
      </motion.p>

      <motion.h1
        {...stagger(1)}
        className="mt-2 font-[family-name:var(--font-fraunces)] text-3xl leading-tight text-primary"
      >
        {insight.title}
      </motion.h1>

      <motion.div {...stagger(2)} className="mt-6">
        <KeyNumber value={insight.keyMetricValue} colorBySign className="text-5xl" />
        <p className="mt-1 text-sm text-tertiary">{insight.keyMetricLabel}</p>
      </motion.div>

      <motion.p {...stagger(3)} className="mt-6 text-base leading-relaxed text-secondary">
        {insight.body}
      </motion.p>

      {insight.cta && (
        <motion.div {...stagger(4)} className="mt-8">
          <Link
            href={insight.cta.action}
            className="inline-block border border-[var(--text-primary)] bg-[var(--accent-primary)] px-6 py-3 text-sm font-bold text-[#17150d]"
          >
            {insight.cta.label}
          </Link>
        </motion.div>
      )}

      <motion.p {...stagger(5)} className="mt-10 text-[10px] text-tertiary">
        Découverte repérée automatiquement dans tes chiffres.
      </motion.p>
    </div>
  );
}
