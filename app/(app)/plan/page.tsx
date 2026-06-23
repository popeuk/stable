"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, FlaskConical, ArrowRight, RotateCcw, Trophy } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { Explain } from "@/components/ed/explain";
import { CopiloteNote } from "@/components/ed/copilote";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { useCoachStore } from "@/stores/coach-store";
import { generateRecommendations } from "@/lib/domain/recommendations";
import { periodKey } from "@/lib/utils/period";
import { LESSON_KEYS } from "@/content/lessons";
import { formatEur } from "@/lib/utils/format-currency";

const TOTAL_NOTIONS = LESSON_KEYS.length;

export default function PlanPage() {
  return (
    <ClientGate>
      <Plan />
    </ClientGate>
  );
}

function masteryLabel(score: number): string {
  if (score >= 16) return "Stratège";
  if (score >= 8) return "Pilote";
  if (score >= 3) return "Éclairé";
  return "Débutant";
}

function Plan() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const { actions, seenLessons, commit, complete, drop, reopen } = useCoachStore();

  const recos = useMemo(() => generateRecommendations(data, active), [data, active]);
  const engagedIds = new Set(actions.filter((a) => a.status === "engaged").map((a) => a.recoId));
  const toDecide = recos.filter((r) => !engagedIds.has(r.id));
  const engaged = actions.filter((a) => a.status === "engaged");
  const done = actions.filter((a) => a.status === "done");

  const notions = seenLessons.length;
  const decisions = done.length;
  const score = notions + decisions * 2;
  const gainSecured = done.reduce((s, a) => s + a.expectedImpact, 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">Mon plan</h1>
        <p className="mt-0.5 text-[14px] text-secondary">
          Ton copilote te propose, tu décides, il suit l&apos;effet.
        </p>
      </header>

      {/* Parcours de pilotage */}
      <section className="border border-[var(--border-strong)] bg-elevated p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-tertiary">
              Ton niveau de pilotage
            </p>
            <p className="mt-1 font-[family-name:var(--font-fraunces)] text-2xl text-primary">
              {masteryLabel(score)}
            </p>
          </div>
          <Trophy size={26} className="text-[var(--accent-primary)]" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 border-t border-[var(--border-default)] pt-3 text-center">
          <Mini label="Notions comprises" value={`${notions}/${TOTAL_NOTIONS}`} />
          <Mini label="Décisions prises" value={`${decisions}`} />
          <Mini label="Gains visés" value={formatEur(gainSecured)} />
        </div>
      </section>

      {/* À décider */}
      <section>
        <h2 className="mb-2 text-[13px] font-bold uppercase tracking-[0.08em] text-tertiary">
          À décider
        </h2>
        {toDecide.length === 0 ? (
          <p className="border border-[var(--border-default)] bg-elevated p-4 text-[14px] text-tertiary">
            Rien d&apos;urgent à décider. Reviens après ta prochaine saisie.
          </p>
        ) : (
          <div className="space-y-2">
            {toDecide.map((r) => (
              <div key={r.id} className="border border-[var(--border-strong)] bg-elevated p-4">
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
              </div>
            ))}
          </div>
        )}
      </section>

      {/* En cours */}
      {engaged.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-[0.08em] text-tertiary">
            En cours ({engaged.length})
          </h2>
          <div className="space-y-2">
            {engaged.map((a) => (
              <div
                key={a.id}
                className="border border-[var(--text-primary)] bg-[var(--text-primary)] p-4 text-[var(--bg-base)]"
              >
                <p className="text-[15px] font-bold">{a.title}</p>
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
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Fait */}
      {done.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-[0.08em] text-tertiary">
            Fait ({done.length})
          </h2>
          <CopiloteNote label="Bien joué">
            Tu as pris {done.length} décision{done.length > 1 ? "s" : ""} pour{" "}
            {formatEur(gainSecured)}/mois visés. Surveille l&apos;effet sur ta marge les prochains mois —
            c&apos;est comme ça qu&apos;on pilote.
          </CopiloteNote>
          <ul className="mt-2 border-t border-[var(--border-default)]">
            {done.map((a) => (
              <motion.li
                key={a.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 border-b border-[var(--border-default)] py-3"
              >
                <Check size={16} className="shrink-0 text-[var(--c-success)]" />
                <span className="flex-1 text-[14px] text-secondary line-through decoration-[var(--border-strong)]">
                  {a.title}
                </span>
                <button
                  onClick={() => reopen(a.id)}
                  aria-label="Rouvrir"
                  className="shrink-0 p-1 text-tertiary"
                >
                  <RotateCcw size={14} />
                </button>
              </motion.li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[15px] font-extrabold tabular-nums text-primary">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase leading-tight tracking-wide text-tertiary">
        {label}
      </p>
    </div>
  );
}
