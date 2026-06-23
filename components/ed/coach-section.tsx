"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Check, FlaskConical, ArrowRight, Sparkles } from "lucide-react";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { useCoachStore } from "@/stores/coach-store";
import { generateRecommendations } from "@/lib/domain/recommendations";
import { periodKey } from "@/lib/utils/period";
import { formatEur } from "@/lib/utils/format-currency";
import { Explain } from "@/components/ed/explain";
import { HorseLine } from "@/components/ed/atoms";

export function CoachSection() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const actions = useCoachStore((s) => s.actions);
  const commit = useCoachStore((s) => s.commit);
  const complete = useCoachStore((s) => s.complete);
  const drop = useCoachStore((s) => s.drop);

  const recos = useMemo(() => generateRecommendations(data, active), [data, active]);
  const engagedIds = new Set(actions.filter((a) => a.status === "engaged").map((a) => a.recoId));
  const proposed = recos.filter((r) => !engagedIds.has(r.id)).slice(0, 2);
  const engaged = actions.filter((a) => a.status === "engaged").slice(0, 3);

  if (proposed.length === 0 && engaged.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-[var(--accent-primary)]" />
          <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-tertiary">
            Ton plan de la semaine
          </h2>
        </div>
        <Link href="/plan" className="text-[12px] font-semibold text-tertiary">
          Mon plan ›
        </Link>
      </div>

      {/* Suivi : ce que tu avais décidé */}
      <AnimatePresence initial={false}>
        {engaged.map((a) => (
          <motion.div
            key={a.id}
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-2 overflow-hidden border border-[var(--text-primary)] bg-[var(--text-primary)] p-4 text-[var(--bg-base)]"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--accent-primary)]">
              Tu t&apos;étais engagé
            </p>
            <p className="mt-1 text-[15px] font-bold">{a.title}</p>
            {a.expectedImpact > 0 && (
              <p className="mt-0.5 text-[12px] text-[var(--bg-base)]/70">
                Effet visé : +{formatEur(a.expectedImpact)} / mois
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => complete(a.id)}
                className="flex items-center gap-1.5 bg-[var(--accent-primary)] px-3 py-1.5 text-[13px] font-bold text-[#17150d]"
              >
                <Check size={14} /> C&apos;est fait
              </button>
              <button
                onClick={() => drop(a.id)}
                className="px-3 py-1.5 text-[13px] font-semibold text-[var(--bg-base)]/70"
              >
                Laisser tomber
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Propositions chiffrées */}
      <div className="space-y-2">
        {proposed.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="border border-[var(--border-strong)] bg-elevated p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[15px] font-bold leading-snug text-primary">{r.title}</p>
              {r.expectedImpact > 0 && (
                <span className="shrink-0 whitespace-nowrap bg-[var(--c-success-soft)] px-2 py-1 text-[12px] font-extrabold text-[var(--c-success)]">
                  +{formatEur(r.expectedImpact)}/mois
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">
              {r.why}
              {r.lessonKey && (
                <>
                  {" "}
                  <Explain k={r.lessonKey} className="text-[var(--accent-primary)]">
                    En savoir plus
                  </Explain>
                </>
              )}
            </p>
            <div className="mt-3 flex gap-2">
              {r.scenarioHref && (
                <Link
                  href={r.scenarioHref}
                  className="flex items-center gap-1.5 border border-[var(--border-strong)] px-3 py-1.5 text-[13px] font-bold text-primary"
                >
                  <FlaskConical size={14} /> Tester
                </Link>
              )}
              <button
                onClick={() =>
                  commit({
                    recoId: r.id,
                    type: r.type,
                    title: r.title,
                    expectedImpact: r.expectedImpact,
                    relatedHorseId: r.relatedHorseId,
                    costPost: r.costPost,
                    periodKey: periodKey(active),
                  })
                }
                className="flex items-center gap-1.5 border border-[var(--text-primary)] bg-[var(--accent-primary)] px-3 py-1.5 text-[13px] font-bold text-[#17150d]"
              >
                Je m&apos;y mets <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {proposed.length > 0 && (
        <div className="pointer-events-none relative">
          <HorseLine
            size={64}
            stroke={1}
            color="var(--border-default)"
            className="absolute -top-1 right-0 opacity-60"
          />
        </div>
      )}
    </section>
  );
}
