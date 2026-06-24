"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, AlertTriangle, ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { KeyNumber } from "@/components/ui/key-number";
import { Sparkline } from "@/components/ui/sparkline";
import { Explain } from "@/components/ed/explain";
import { SectionHead } from "@/components/ed/atoms";
import { RangeSelector } from "@/components/ed/range-selector";
import { InsightsCarousel } from "@/components/ed/insights-carousel";
import { CoachSection } from "@/components/ed/coach-section";
import { FirstRun } from "@/components/ed/first-run";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { useHorses } from "@/lib/hooks/use-horses";
import {
  aggregateStablePnl,
  aggregateHorseNet,
  expenseBreakdown,
  expenseMovers,
  stableMarginSeries,
} from "@/lib/domain/calculations";
import { pickNotion } from "@/lib/domain/notion";
import { LESSONS } from "@/content/lessons";
import { RANGE_PRESETS, rangePeriods } from "@/lib/utils/period";
import { formatLongDate } from "@/lib/utils/format-date";

function eur(n: number) {
  const v = new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n)));
  return `${n < 0 ? "−" : ""}${v} €`;
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
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } },
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
  const allHorses = useHorses();

  // From-zero: welcome the user instead of an empty dashboard.
  const hasHorses = data.horses.some((h) => !h.isArchived);
  const hasMoney =
    data.revenues.length > 0 ||
    data.directExpenses.length > 0 ||
    data.sharedExpenses.length > 0 ||
    (data.recurringExpenses?.length ?? 0) > 0;
  if (!hasHorses || !hasMoney) return <FirstRun />;

  const agg = aggregateStablePnl(data, periods);
  const positive = agg.netResult >= 0;
  const series = stableMarginSeries(data, active, 12);
  const breakdown = expenseBreakdown(data, periods).slice(0, 4);
  const movers = expenseMovers(data, active).slice(0, 4);
  const maxSlice = Math.max(1, ...breakdown.map((b) => b.amount));

  const ranked = data.horses
    .filter((h) => !h.isArchived)
    .map((h) => ({ horse: h, net: aggregateHorseNet(data, h.id, periods) }))
    .sort((a, b) => b.net - a.net);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const underThreshold = ranked.filter((r) => r.net < 0);
  const declining = allHorses.filter((h) => h.trend === "baisse");

  const periodLabel =
    preset === "month" ? "ce mois" : RANGE_PRESETS.find((r) => r.value === preset)!.label.toLowerCase();

  const notionKey = pickNotion(data, active);
  const notion = LESSONS[notionKey];

  const verdict =
    positive
      ? `Tu gardes ${agg.netMarginPct} % de ce que tu encaisses.${best ? ` ${best.horse.name} porte l'écurie` : ""}${
          worst && worst.net < 0 ? `, mais ${worst.horse.name} passe sous son seuil.` : "."
        }`
      : `Tu perds de l'argent ${periodLabel}. Tes plus gros postes et tes places vides sont les premiers leviers.`;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
      <motion.header variants={item}>
        <p className="text-[13px] font-semibold capitalize text-tertiary">{formatLongDate(new Date())}</p>
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">{greeting()}.</h1>
      </motion.header>

      <motion.div variants={item}>
        <RangeSelector />
      </motion.div>

      {/* Schéma : CA − Dépenses = Marge */}
      <motion.section variants={item} className="border border-[var(--border-strong)] bg-elevated">
        <EqRow
          sign=""
          label="Chiffre d'affaires"
          lesson="chiffre_affaires"
          value={eur(agg.revenue)}
        />
        <EqRow sign="−" label="Dépenses" lesson="depenses" value={eur(agg.charges)} muted />
        <div className="flex items-center justify-between border-t-2 border-[var(--text-primary)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="w-4 text-[18px] font-bold text-tertiary">=</span>
            <Explain k="rentabilite" className="text-[12px] font-bold uppercase tracking-wide text-tertiary">
              Marge ({periodLabel})
            </Explain>
          </div>
          <div className="flex items-baseline gap-2">
            <KeyNumber
              value={agg.netResult}
              colorBySign
              className="font-[family-name:var(--font-fraunces)] text-3xl"
            />
            <span
              className="text-[13px] font-bold tabular-nums"
              style={{ color: positive ? "var(--c-success)" : "var(--c-danger)" }}
            >
              {agg.netMarginPct} %
            </span>
          </div>
        </div>
        <div className="px-4 pb-3">
          <Sparkline data={series} area width={380} height={34} className="w-full" />
          <p className="mt-1.5 text-[13px] leading-snug text-secondary">{verdict}</p>
        </div>
      </motion.section>

      {/* Ce qui impacte ta marge */}
      {breakdown.length > 0 && (
        <motion.section variants={item}>
          <SectionHead title="Ce qui pèse sur ta marge" />
          <div className="space-y-2.5 border border-[var(--border-strong)] bg-elevated p-4">
            {breakdown.map((slice, i) => (
              <div key={slice.label}>
                <div className="mb-1 flex items-baseline justify-between text-[13px]">
                  <span className="font-semibold text-primary">{slice.label}</span>
                  <span className="tabular-nums text-secondary">
                    {eur(slice.amount)} · {Math.round(slice.share * 100)} %
                  </span>
                </div>
                <div className="h-2 bg-[var(--bg-pressed)]">
                  <motion.div
                    className="h-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(slice.amount / maxSlice) * 100}%` }}
                    transition={{ duration: 0.6, delay: 0.1 + i * 0.05 }}
                    style={{ background: i === 0 ? "var(--c-warning)" : "var(--accent-primary)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Ce qui a bougé ce mois (vs mois précédent) */}
      {movers.length > 0 && (
        <motion.section variants={item}>
          <SectionHead title="Ce qui a bougé ce mois" />
          <ul className="border-t border-[var(--border-default)]">
            {movers.map((m) => {
              const worse = m.delta > 0;
              return (
                <li
                  key={m.label}
                  className="flex items-center gap-3 border-b border-[var(--border-default)] py-2.5"
                >
                  {worse ? (
                    <TrendingUp size={16} style={{ color: "var(--c-danger)" }} />
                  ) : (
                    <TrendingDown size={16} style={{ color: "var(--c-success)" }} />
                  )}
                  <span className="flex-1 text-[14px] font-semibold text-primary">{m.label}</span>
                  <span className="text-[12px] tabular-nums text-tertiary">{eur(m.current)}</span>
                  <span
                    className="w-[68px] text-right text-[14px] font-extrabold tabular-nums"
                    style={{ color: worse ? "var(--c-danger)" : "var(--c-success)" }}
                  >
                    {m.delta > 0 ? "+" : ""}
                    {eur(m.delta)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-1.5 text-[12px] text-tertiary">vs le mois dernier · ce qui creuse ou allège ta marge</p>
        </motion.section>
      )}

      {/* L'accompagnement */}
      <motion.div variants={item}>
        <CoachSection />
      </motion.div>

      <motion.div variants={item}>
        <InsightsCarousel />
      </motion.div>

      {/* Notion du moment */}
      {notion && (
        <motion.div variants={item}>
          <Explain k={notionKey} variant="plain" className="block w-full text-left">
            <div className="flex items-center justify-between border border-[var(--border-strong)] bg-[var(--accent-primary-soft)] p-4">
              <div className="pr-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--accent-primary)]">
                  La notion du moment
                </p>
                <p className="mt-1 text-[15px] font-bold text-primary">{notion.title}</p>
                <p className="mt-0.5 text-[13px] text-secondary">{notion.definition}</p>
              </div>
              <ArrowUpRight size={20} className="shrink-0 text-[var(--accent-primary)]" />
            </div>
          </Explain>
        </motion.div>
      )}

      {/* Alertes */}
      {(underThreshold.length > 0 || declining.length > 0) && (
        <motion.section variants={item} className="space-y-2">
          {underThreshold.length > 0 && (
            <AlertRow
              href="/ecurie"
              text={`${underThreshold.length} cheval${underThreshold.length > 1 ? "x" : ""} sous le seuil`}
              hint={
                underThreshold.length > 1
                  ? "leur place coûte plus qu'elle ne rapporte"
                  : "sa place coûte plus qu'elle ne rapporte"
              }
            />
          )}
          {declining.slice(0, 1).map((h) => (
            <AlertRow
              key={h.horse.id}
              href={`/cheval/${h.horse.id}`}
              text={`${h.horse.name} perd en marge`}
              hint="sa tendance baisse depuis 3 mois"
            />
          ))}
        </motion.section>
      )}

      {/* Chevaux */}
      <motion.section variants={item}>
        <SectionHead title="Tes chevaux" action={<Link href="/ecurie">Tout voir ›</Link>} />
        <ul className="border-t border-[var(--border-default)]">
          {ranked.slice(0, 4).map((h, i) => {
            const ok = h.net >= 0;
            return (
              <li key={h.horse.id}>
                <Link
                  href={`/cheval/${h.horse.id}`}
                  className="flex items-center gap-4 border-b border-[var(--border-default)] py-3.5"
                >
                  <span className="w-7 text-[13px] font-bold tabular-nums text-tertiary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1">
                    <p className="text-[16px] font-bold leading-tight text-primary">{h.horse.name}</p>
                    <p className="text-[12px] text-tertiary">{ok ? "rapporte" : "te coûte"} {periodLabel}</p>
                  </div>
                  <span
                    className="text-[16px] font-extrabold tabular-nums"
                    style={{ color: ok ? "var(--c-success)" : "var(--c-danger)" }}
                  >
                    {eur(h.net)}
                  </span>
                  <ChevronRight size={16} className="text-tertiary" />
                </Link>
              </li>
            );
          })}
        </ul>
      </motion.section>
    </motion.div>
  );
}

function EqRow({
  sign,
  label,
  lesson,
  value,
  muted,
}: {
  sign: string;
  label: string;
  lesson: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="w-4 text-[18px] font-bold text-tertiary">{sign}</span>
        <Explain k={lesson} className="text-[12px] font-bold uppercase tracking-wide text-tertiary">
          {label}
        </Explain>
      </div>
      <span
        className={`font-[family-name:var(--font-fraunces)] text-2xl tabular-nums ${muted ? "text-secondary" : "text-primary"}`}
      >
        {value}
      </span>
    </div>
  );
}

function AlertRow({ href, text, hint }: { href: string; text: string; hint: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border border-[var(--c-danger)] bg-[var(--c-danger-soft)] p-3.5"
    >
      <AlertTriangle size={18} style={{ color: "var(--c-danger)" }} />
      <div className="flex-1">
        <p className="text-[14px] font-bold text-primary">{text}</p>
        <p className="text-[12px] text-secondary">{hint}</p>
      </div>
      <ChevronRight size={16} style={{ color: "var(--c-danger)" }} />
    </Link>
  );
}
