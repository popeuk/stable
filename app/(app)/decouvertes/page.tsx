"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { KeyNumber } from "@/components/ui/key-number";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { generateInsights } from "@/lib/domain/insights-engine";
import { formatMonthYear } from "@/lib/utils/format-date";

export default function DecouvertesPage() {
  return (
    <ClientGate>
      <Decouvertes />
    </ClientGate>
  );
}

function Decouvertes() {
  const data = useDataStore();
  const period = usePeriodStore((s) => s.active);
  const insights = generateInsights(data, period);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-[family-name:var(--font-bricolage)] text-2xl text-primary">
          Ce qu’on a remarqué
        </h1>
        <p className="text-sm text-tertiary capitalize">{formatMonthYear(period)}</p>
        <p className="text-sm text-tertiary">Des choses repérées dans tes chiffres ce mois-ci. Touche une carte pour comprendre.</p>
      </header>

      {insights.length === 0 ? (
        <EmptyState
          title="Rien de spécial ce mois-ci."
          body="Continue à noter ce qui rentre et ce qui sort. Dès qu’on repère quelque chose d’utile, ça s’affiche ici."
        />
      ) : (
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <Link key={insight.id} href={`/decouvertes/detail?id=${encodeURIComponent(insight.id)}`}>
              <motion.article
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-[var(--radius-lg)] border bg-elevated p-5"
              >
                <p className="font-[family-name:var(--font-bricolage)] text-xl text-primary">
                  {insight.title}
                </p>
                <div className="my-2">
                  <KeyNumber
                    value={insight.keyMetricValue}
                    colorBySign
                    className="text-3xl"
                    animateOnMount={false}
                  />
                  <span className="ml-2 text-2xs text-tertiary">{insight.keyMetricLabel}</span>
                </div>
                <p className="text-sm text-secondary line-clamp-2">{insight.body}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-2xs text-[var(--accent-primary)]">
                  Comprendre <ChevronRight size={13} />
                </span>
              </motion.article>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
