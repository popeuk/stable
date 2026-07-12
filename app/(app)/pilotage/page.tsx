"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  ReceiptText,
} from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { KeyNumber } from "@/components/ui/key-number";
import { Sparkline } from "@/components/ui/sparkline";
import { Explain } from "@/components/ed/explain";
import { SectionHead } from "@/components/ed/atoms";
import { RangeSelector } from "@/components/ed/range-selector";
import { InsightsCarousel } from "@/components/ed/insights-carousel";
import { CoachSection } from "@/components/ed/coach-section";
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
import { equilibrium } from "@/lib/domain/equilibrium";
import { horseActivity } from "@/lib/domain/activity";
import { pickNotion } from "@/lib/domain/notion";
import { LESSONS } from "@/content/lessons";
import { RANGE_PRESETS, rangePeriods } from "@/lib/utils/period";
import { formatEur } from "@/lib/utils/format-currency";
import { localToday } from "@/lib/utils/local-date";

/**
 * Le Pilotage : la rentabilité, l'activité, les analyses. Rien ne se
 * saisit ici — tout est DÉRIVÉ du planning exécuté et des contrats.
 * Faire tourner l'écurie construit ces chiffres en arrière-plan.
 */
function eur(n: number) {
  const v = new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n)));
  return `${n < 0 ? "−" : ""}${v} €`;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function PilotagePage() {
  return (
    <ClientGate>
      <Pilotage />
    </ClientGate>
  );
}

function Pilotage() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const preset = usePeriodStore((s) => s.preset);
  const periods = useMemo(() => rangePeriods(active, preset), [active, preset]);
  const allHorses = useHorses();
  // Progressive disclosure: analysis sections stay folded until asked for.
  const [detail, setDetail] = useState(false);

  const hasHorses = data.horses.some((h) => !h.isArchived);
  if (!hasHorses) {
    return (
      <div className="card p-5 text-center">
        <p className="text-[15px] font-bold text-primary">Encore rien à piloter.</p>
        <p className="mt-1 text-[13px] text-secondary">
          Ajoute tes chevaux et fais tourner ton planning : la rentabilité se
          construira ici toute seule.
        </p>
        <Link
          href="/maintenant"
          className="mt-4 inline-flex items-center gap-1.5 btn-primary px-4 py-2 text-[13px] text-[var(--on-accent)]"
        >
          Retour à ma journée
        </Link>
      </div>
    );
  }

  const agg = aggregateStablePnl(data, periods);
  const eq = equilibrium(data, periods);
  const positive = agg.netResult >= 0;
  const series = stableMarginSeries(data, active, 12);
  const breakdown = expenseBreakdown(data, periods).slice(0, 4);
  const movers = expenseMovers(data, active).slice(0, 4);
  const maxSlice = Math.max(1, ...breakdown.map((b) => b.amount));
  const todayIso = localToday();

  const ranked = data.horses
    .filter((h) => !h.isArchived)
    .map((h) => ({ horse: h, net: aggregateHorseNet(data, h.id, periods) }))
    .sort((a, b) => b.net - a.net);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const underThreshold = ranked.filter((r) => r.net < 0);
  const declining = allHorses.filter((h) => h.trend === "baisse");

  // L'activité, dérivée du planning exécuté — personne ne l'a saisie.
  const activity = horseActivity(data, todayIso, 30);
  const activeCount = activity.filter((a) => a.sessions > 0).length;
  const idle = activity.filter((a) => a.sessions === 0);
  const maxSessions = Math.max(1, ...activity.map((a) => a.sessions));
  const horseNameOf = (id: string) => data.horses.find((h) => h.id === id)?.name ?? "";

  const periodLabel =
    preset === "month" ? "ce mois" : RANGE_PRESETS.find((r) => r.value === preset)!.label.toLowerCase();

  const notionKey = pickNotion(data, active);
  const notion = LESSONS[notionKey];

  const verdict = positive
    ? `Tu gardes ${agg.netMarginPct} % de ce que tu encaisses.${best ? ` ${best.horse.name} porte l'écurie` : ""}${
        worst && worst.net < 0 ? `, mais ${worst.horse.name} passe sous son seuil.` : "."
      }`
    : `Tu perds de l'argent ${periodLabel}. Tes plus gros postes et tes places vides sont les premiers leviers.`;

  // The pulse — colour is the state. Gold-sage when covered, amber when
  // close, ember when the stable loses money.
  const health: "good" | "tight" | "bad" =
    positive && eq.coverage >= 1 ? "good" : eq.coverage >= 0.85 ? "tight" : "bad";
  const pulse = {
    good: { a: "rgba(189, 96, 23, 0.26)", b: "rgba(124, 144, 112, 0.24)" },
    tight: { a: "rgba(168, 119, 15, 0.26)", b: "rgba(189, 96, 23, 0.16)" },
    bad: { a: "rgba(189, 63, 44, 0.20)", b: "rgba(168, 119, 15, 0.15)" },
  }[health];
  const coverPct = Math.round(Math.min(1, eq.coverage) * 100);
  const coverColor =
    health === "good" ? "var(--c-success)" : health === "tight" ? "var(--c-warning)" : "var(--c-danger)";

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
      <motion.header variants={item} className="-mb-3 flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">Pilotage</h1>
        <p className="text-[12px] text-tertiary">Dérivé de ton planning, tout seul.</p>
      </motion.header>

      {/* Le Pouls */}
      <motion.section variants={item} className="tray">
        <div className="grain card relative overflow-hidden !rounded-[24px]">
        <div
          aria-hidden
          className="pulse-field absolute inset-0"
          style={{ "--pulse-a": pulse.a, "--pulse-b": pulse.b } as React.CSSProperties}
        />
        <div className="relative px-5 pb-6 pt-6">
          <div className="flex items-baseline gap-3">
            <KeyNumber
              value={agg.netResult}
              colorBySign
              className="text-[56px] leading-none tracking-[-0.03em]"
            />
            <span
              className="text-[15px] font-bold tabular-nums"
              style={{ color: positive ? "var(--c-success)" : "var(--c-danger)" }}
            >
              {agg.netMarginPct} %
            </span>
          </div>
          <Explain k="marge_nette" className="mt-1 block text-left text-[12px] font-bold uppercase tracking-[0.12em] text-tertiary">
            Ta marge {periodLabel}
          </Explain>

          <p className="mt-4 max-w-[30ch] text-[15px] leading-snug text-primary">{verdict}</p>

          {/* Le seuil : une ligne, pas une carte. */}
          {eq.monthlyCharges > 0 && (
            <Explain k="seuil_rentabilite" variant="plain" className="mt-6 block w-full text-left">
              <span className="block h-[3px] w-full" style={{ background: "var(--border-default)" }}>
                <motion.span
                  className="block h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${coverPct}%` }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  style={{ background: coverColor }}
                />
              </span>
              <span className="mt-1.5 flex justify-between text-[12px] text-secondary">
                <span>
                  {eq.coverage >= 1 ? (
                    "Charges couvertes : au-delà, tout est marge."
                  ) : eq.missingPensionEquiv > 0 ? (
                    <>
                      Encore {formatEur(eq.monthlyGap)}/mois, soit{" "}
                      <strong className="text-primary">
                        environ {eq.missingPensionEquiv.toLocaleString("fr-FR")} pension
                        {eq.missingPensionEquiv >= 2 ? "s" : ""}
                      </strong>
                    </>
                  ) : (
                    <>Encore {formatEur(eq.monthlyGap)}/mois pour couvrir tes charges</>
                  )}
                </span>
                <span className="tabular-nums font-bold" style={{ color: coverColor }}>
                  {coverPct} %
                </span>
              </span>
            </Explain>
          )}

          <div className="mt-5">
            <RangeSelector />
          </div>
        </div>
        </div>
      </motion.section>

      {/* D'où ça vient */}
      <motion.section variants={item} className="-mt-2">
        <div className="hairline flex items-baseline justify-between py-3">
          <Explain k="chiffre_affaires" className="text-[13px] font-bold uppercase tracking-wide text-tertiary">
            Chiffre d&apos;affaires
          </Explain>
          <span className="font-[family-name:var(--font-fraunces)] text-xl tabular-nums text-primary">
            {eur(agg.revenue)}
          </span>
        </div>
        <div className="hairline flex items-baseline justify-between py-3">
          <Explain k="depenses" className="text-[13px] font-bold uppercase tracking-wide text-tertiary">
            Dépenses
          </Explain>
          <span className="font-[family-name:var(--font-fraunces)] text-xl tabular-nums text-secondary">
            −{eur(agg.charges)}
          </span>
        </div>
        <div className="pt-2">
          <Sparkline data={series} area width={380} height={34} className="w-full" />
          {eq.horseCount > 0 && eq.avgPension > 0 && (
            <p className="mt-2 text-[12px] text-tertiary">
              Une place occupée te laisse en moyenne{" "}
              <strong style={{ color: eq.marginPerHorse >= 0 ? "var(--c-success)" : "var(--c-danger)" }}>
                {eq.marginPerHorse >= 0 ? "+" : ""}
                {formatEur(eq.marginPerHorse)}/mois
              </strong>
              .
            </p>
          )}
        </div>
      </motion.section>

      {/* L'activité : dérivée des séances confirmées, zéro saisie */}
      {activeCount > 0 && (
        <motion.section variants={item}>
          <SectionHead title="L'activité des 30 jours" />
          <div className="space-y-2.5">
            {activity
              .filter((a) => a.sessions > 0)
              .slice(0, 6)
              .map((a) => (
                <div key={a.horseId}>
                  <div className="mb-1 flex items-baseline justify-between text-[13px]">
                    <span className="font-semibold text-primary">{horseNameOf(a.horseId)}</span>
                    <span className="tabular-nums text-secondary">
                      {a.sessions} séance{a.sessions > 1 ? "s" : ""}
                      {a.revenue > 0 ? ` · ${formatEur(a.revenue)}` : ""}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-pressed)]">
                    <motion.div
                      className="h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(a.sessions / maxSessions) * 100}%` }}
                      transition={{ duration: 0.6 }}
                      style={{ background: "var(--accent-secondary)" }}
                    />
                  </div>
                </div>
              ))}
          </div>
          {idle.length > 0 && (
            <p className="mt-2 text-[12px] text-tertiary">
              Sans séance sur 30 jours :{" "}
              <strong className="text-secondary">
                {idle.map((a) => horseNameOf(a.horseId)).join(", ")}
              </strong>
              .
            </p>
          )}
        </motion.section>
      )}

      {/* L'accompagnement d'abord : l'action, pas l'analyse */}
      <motion.div variants={item}>
        <CoachSection />
      </motion.div>

      {/* Le détail, seulement si on le demande */}
      <motion.div variants={item} className="flex justify-center">
        <button
          onClick={() => setDetail((d) => !d)}
          className="btn-ghost flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-secondary"
        >
          {detail ? "Masquer le détail" : "Voir le détail du mois"}
          <ChevronDown
            size={15}
            style={{
              transform: detail ? "rotate(180deg)" : "none",
              transition: "transform 0.3s var(--ease-signature)",
            }}
          />
        </button>
      </motion.div>

      {detail && (
        <>
      {/* Ce qui pèse */}
      {breakdown.length > 0 && (
        <motion.section variants={item}>
          <SectionHead title="Ce qui pèse sur ta marge" />
          <div className="space-y-3">
            {breakdown.map((slice, i) => (
              <div key={slice.label}>
                <div className="mb-1 flex items-baseline justify-between text-[13px]">
                  <span className="font-semibold text-primary">{slice.label}</span>
                  <span className="tabular-nums text-secondary">
                    {eur(slice.amount)} · {Math.round(slice.share * 100)} %
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-pressed)]">
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

      {/* Ce qui a bougé */}
      {movers.length > 0 && (
        <motion.section variants={item}>
          <SectionHead title="Ce qui a bougé ce mois" />
          <ul className="hairline">
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

      <motion.div variants={item}>
        <InsightsCarousel />
      </motion.div>

      {/* Les analyses : les mêmes données sous d'autres angles */}
      <motion.section variants={item}>
        <SectionHead title="Analyses" />
        <div className="grid grid-cols-2 gap-2">
          <Link href="/audit" className="card p-3.5">
            <p className="text-[14px] font-bold text-primary">Audit du mois</p>
            <p className="text-[12px] text-tertiary">Le bilan en 5 cartes</p>
          </Link>
          <Link href="/scenarios/nouveau" className="card p-3.5">
            <p className="text-[14px] font-bold text-primary">Scénarios</p>
            <p className="text-[12px] text-tertiary">Et si… en direct</p>
          </Link>
        </div>
      </motion.section>
        </>
      )}

      {/* La notion du moment */}
      {notion && (
        <motion.div variants={item}>
          <Explain k={notionKey} variant="plain" className="block w-full text-left">
            <div className="grain relative overflow-hidden rounded-[var(--radius-xl)] bg-[var(--accent-primary-soft)] p-4">
              <div className="relative flex items-center justify-between">
                <div className="pr-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--accent-primary)]">
                    La notion du moment
                  </p>
                  <p className="mt-1 text-[15px] font-bold text-primary">{notion.title}</p>
                  <p className="mt-0.5 text-[13px] text-secondary">{notion.definition}</p>
                </div>
                <ArrowUpRight size={20} className="shrink-0 text-[var(--accent-primary)]" />
              </div>
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
              text={`${underThreshold.length} ${underThreshold.length > 1 ? "chevaux" : "cheval"} sous le seuil`}
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
              href={`/cheval?id=${h.horse.id}`}
              text={`${h.horse.name} perd en marge`}
              hint="sa tendance baisse depuis 3 mois"
            />
          ))}
        </motion.section>
      )}

      {/* Tes chevaux */}
      <motion.section variants={item}>
        <SectionHead title="Tes chevaux" action={<Link href="/ecurie">Tout voir ›</Link>} />
        <ul className="hairline">
          {ranked.slice(0, 4).map((h, i) => {
            const ok = h.net >= 0;
            return (
              <li key={h.horse.id}>
                <Link
                  href={`/cheval?id=${h.horse.id}`}
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

      {/* Le journal : l'historique complet, en retrait */}
      <motion.div variants={item}>
        <Link
          href="/depenses"
          className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--border-default)] px-4 py-3.5"
        >
          <span className="flex items-center gap-2 text-[14px] font-bold text-primary">
            <ReceiptText size={16} className="text-tertiary" /> Le journal complet
          </span>
          <ChevronRight size={16} className="text-tertiary" />
        </Link>
      </motion.div>
    </motion.div>
  );
}

function AlertRow({ href, text, hint }: { href: string; text: string; hint: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--c-danger-soft)] p-3.5"
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
