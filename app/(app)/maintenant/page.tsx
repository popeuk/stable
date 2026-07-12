"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Plus, CalendarRange } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { DeadlineRow, SessionRow } from "@/components/ed/care-bits";
import { FirstRun } from "@/components/ed/first-run";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { aggregateStablePnl } from "@/lib/domain/calculations";
import { equilibrium } from "@/lib/domain/equilibrium";
import { upcomingDeadlines, agendaSessions } from "@/lib/domain/care";
import { rangePeriods } from "@/lib/utils/period";
import { formatLongDate } from "@/lib/utils/format-date";
import { localToday } from "@/lib/utils/local-date";

/**
 * L'accueil : ta journée, rien d'autre. Ce qu'il y a à faire aujourd'hui,
 * ce qui arrive demain, ce qui est en retard — chaque ligne se règle en un
 * geste. L'argent ? Une seule ligne, dérivée toute seule : le détail vit
 * dans Pilotage. Tu fais tourner ton écurie, le logiciel suit.
 */
function eur(n: number) {
  const v = new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n)));
  return `${n < 0 ? "−" : "+"}${v} €`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function MaintenantPage() {
  return (
    <ClientGate>
      <Maintenant />
    </ClientGate>
  );
}

function Maintenant() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const preset = usePeriodStore((s) => s.preset);
  const periods = useMemo(() => rangePeriods(active, preset), [active, preset]);

  // From-zero: welcome the user instead of an empty day.
  const hasHorses = data.horses.some((h) => !h.isArchived);
  const hasMoney =
    data.revenues.length > 0 ||
    data.directExpenses.length > 0 ||
    data.sharedExpenses.length > 0 ||
    (data.recurringExpenses?.length ?? 0) > 0 ||
    (data.recurringRevenues?.length ?? 0) > 0;
  if (!hasHorses || !hasMoney) return <FirstRun />;

  const todayIso = localToday();
  const sessions = agendaSessions(data, todayIso);
  // Aujourd'hui : les séances du jour ET celles qui attendent encore leur
  // feuille de présence (daysUntil < 0 = pas confirmées, à régler).
  const todaySessions = sessions.filter((s) => s.daysUntil <= 0);
  const tomorrowSessions = sessions.filter((s) => s.daysUntil === 1);
  const overdue = upcomingDeadlines(data, todayIso)
    .filter((d) => d.status === "overdue")
    .slice(0, 3);
  const horseNameOf = (id: string) => data.horses.find((h) => h.id === id)?.name ?? "";

  // La seule ligne financière de l'accueil — tout le reste est du planning.
  const agg = aggregateStablePnl(data, periods);
  const eq = equilibrium(data, periods);
  const coverPct = Math.round(Math.min(1, eq.coverage) * 100);
  const coverColor =
    agg.netResult >= 0 && eq.coverage >= 1
      ? "var(--c-success)"
      : eq.coverage >= 0.85
        ? "var(--c-warning)"
        : "var(--c-danger)";

  const emptyDay = todaySessions.length === 0 && overdue.length === 0;

  // Le héro respire avec l'état de l'écurie (les mêmes teintes que le Pouls).
  const health: "good" | "tight" | "bad" =
    agg.netResult >= 0 && eq.coverage >= 1 ? "good" : eq.coverage >= 0.85 ? "tight" : "bad";
  const pulse = {
    good: { a: "rgba(189, 96, 23, 0.26)", b: "rgba(124, 144, 112, 0.24)" },
    tight: { a: "rgba(168, 119, 15, 0.26)", b: "rgba(189, 96, 23, 0.16)" },
    bad: { a: "rgba(189, 63, 44, 0.20)", b: "rgba(168, 119, 15, 0.15)" },
  }[health];
  const summaryBits = [
    todaySessions.length > 0 &&
      `${todaySessions.length} séance${todaySessions.length > 1 ? "s" : ""} aujourd'hui`,
    overdue.length > 0 && `${overdue.length} retard${overdue.length > 1 ? "s" : ""} à rattraper`,
    tomorrowSessions.length > 0 && `${tomorrowSessions.length} demain`,
  ].filter(Boolean);
  const summary =
    summaryBits.length > 0 ? summaryBits.join(" · ") : "Journée calme : rien à confirmer.";

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-7">
      {/* Le héro : ta journée, en un regard */}
      <motion.section variants={item} className="tray">
        <div className="grain card relative overflow-hidden !rounded-[24px]">
          <div
            aria-hidden
            className="pulse-field absolute inset-0"
            style={{ "--pulse-a": pulse.a, "--pulse-b": pulse.b } as React.CSSProperties}
          />
          <div className="relative px-5 pb-5 pt-6">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-tertiary">
              <span className="capitalize">{formatLongDate(new Date())}</span>
            </p>
            <h1 className="title-serif mt-1 text-[34px] leading-none text-primary">
              {greeting()}.
            </h1>
            <p className="mt-3 max-w-[32ch] text-[15px] leading-snug text-primary">{summary}</p>
          </div>
        </div>
      </motion.section>

      {/* Aujourd'hui : ce qu'il y a à faire */}
      <motion.section variants={item}>
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="title-serif text-[22px] text-primary">Aujourd&apos;hui</h2>
          <Link href="/planning" className="text-[12px] font-semibold text-tertiary">
            Tout le planning ›
          </Link>
        </div>
        {emptyDay ? (
          <div className="card p-5 text-center">
            <p className="text-[15px] font-bold text-primary">Rien à confirmer aujourd&apos;hui.</p>
            <p className="mt-1 text-[13px] text-secondary">
              Le micro note tout en une phrase, ou planifie une séance.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Link
                href="/saisie/soin"
                className="inline-flex items-center gap-1.5 btn-primary px-4 py-2 text-[13px] text-[var(--on-accent)]"
              >
                <Plus size={14} /> Planifier
              </Link>
              <Link
                href="/planning"
                className="btn-ghost inline-flex items-center gap-1.5 px-4 py-2 text-[13px]"
              >
                <CalendarRange size={14} /> La semaine
              </Link>
            </div>
          </div>
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {todaySessions.map((sess) => (
                <SessionRow key={sess.key} s={sess} horseName={horseNameOf} />
              ))}
              {overdue.map((d) => (
                <DeadlineRow key={`${d.horseId}-${d.kind}`} d={d} horseName={horseNameOf(d.horseId)} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </motion.section>

      {/* Demain : voir venir, sans y passer du temps */}
      {tomorrowSessions.length > 0 && (
        <motion.section variants={item}>
          <h2 className="title-serif mb-1 text-[19px] text-primary">Demain</h2>
          <ul>
            <AnimatePresence initial={false}>
              {tomorrowSessions.map((sess) => (
                <SessionRow key={sess.key} s={sess} horseName={horseNameOf} />
              ))}
            </AnimatePresence>
          </ul>
        </motion.section>
      )}

      {/* La seule ligne d'argent : dérivée toute seule, détail au Pilotage */}
      <motion.div variants={item}>
        <Link href="/pilotage" className="card block p-4">
          <span className="flex items-center justify-between">
            <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-tertiary">
              Le pouls du mois
            </span>
            <span className="flex items-center gap-1 text-[12px] font-semibold text-tertiary">
              Pilotage <ChevronRight size={14} />
            </span>
          </span>
          <span className="mt-1.5 flex items-baseline justify-between">
            <span
              className="font-[family-name:var(--font-fraunces)] text-[26px] tabular-nums"
              style={{ color: agg.netResult >= 0 ? "var(--c-success)" : "var(--c-danger)" }}
            >
              {eur(agg.netResult)}
            </span>
            <span className="text-[12px] tabular-nums text-secondary">
              charges couvertes à <strong style={{ color: coverColor }}>{coverPct} %</strong>
            </span>
          </span>
          <span className="mt-2 block h-[3px] w-full" style={{ background: "var(--border-default)" }}>
            <motion.span
              className="block h-full"
              initial={{ width: 0 }}
              animate={{ width: `${coverPct}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              style={{ background: coverColor }}
            />
          </span>
        </Link>
      </motion.div>
    </motion.div>
  );
}
