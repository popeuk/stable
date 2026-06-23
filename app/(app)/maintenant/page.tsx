"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { Sparkline } from "@/components/ui/sparkline";
import { Explain } from "@/components/ed/explain";
import { CopiloteNote } from "@/components/ed/copilote";
import { SectionHead } from "@/components/ed/atoms";
import { RangeSelector } from "@/components/ed/range-selector";
import { InsightsCarousel } from "@/components/ed/insights-carousel";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { useHorses } from "@/lib/hooks/use-horses";
import {
  aggregateStablePnl,
  aggregateHorseNet,
  expenseBreakdown,
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

  const agg = aggregateStablePnl(data, periods);
  const positive = agg.netResult >= 0;
  const series = stableMarginSeries(data, active, 12);
  const breakdown = expenseBreakdown(data, periods).slice(0, 5);
  const biggest = breakdown[0];

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
  const maxSlice = Math.max(1, ...breakdown.map((b) => b.amount));

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[13px] font-semibold capitalize text-tertiary">{formatLongDate(new Date())}</p>
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">Bonjour.</h1>
      </header>

      <RangeSelector />

      {/* Hero — rentabilité */}
      <section className="border border-[var(--border-strong)] bg-elevated">
        <div className="px-5 pb-4 pt-4">
          <Explain k="marge_nette" className="text-[11px] font-bold uppercase tracking-[0.08em] text-tertiary">
            Ce que tu gardes ({periodLabel})
          </Explain>
          <p
            className="mt-1 font-[family-name:var(--font-fraunces)] text-5xl tabular-nums"
            style={{ color: positive ? "var(--c-success)" : "var(--c-danger)" }}
          >
            {eur(agg.netResult)}
          </p>
          <div className="mt-3">
            <Sparkline data={series} area width={400} height={42} className="w-full" />
          </div>
        </div>
        <div className="grid grid-cols-3 border-t border-[var(--border-default)] text-center">
          <Kpi label="Chiffre d'affaires" value={eur(agg.revenue)} explain="marge_brute" />
          <Kpi label="Dépenses" value={eur(agg.charges)} explain="cout_direct" divider />
          <Kpi label="Rentabilité" value={`${agg.netMarginPct} %`} explain="marge_nette" divider />
        </div>
      </section>

      {/* Découvertes en carrousel */}
      <InsightsCarousel />

      {/* Où part ton argent */}
      {breakdown.length > 0 && biggest && (
        <section>
          <SectionHead title="Où part ton argent" />
          <div className="space-y-2.5 border border-[var(--border-strong)] bg-elevated p-4">
            {breakdown.map((slice, i) => (
              <div key={slice.label}>
                <div className="mb-1 flex items-baseline justify-between text-[13px]">
                  <span className="font-semibold text-primary">
                    {slice.label}
                    {i === 0 && (
                      <span className="ml-2 bg-[var(--c-warning-soft)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--c-warning)]">
                        à optimiser
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-secondary">
                    {eur(slice.amount)} · {Math.round(slice.share * 100)} %
                  </span>
                </div>
                <div className="h-2 bg-[var(--bg-pressed)]">
                  <div
                    className="h-full"
                    style={{
                      width: `${(slice.amount / maxSlice) * 100}%`,
                      background: i === 0 ? "var(--c-warning)" : "var(--accent-primary)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2">
            <CopiloteNote label="Piste d'optimisation">
              Ton plus gros poste, c&apos;est <b>{biggest.label}</b> ({eur(biggest.amount)},{" "}
              {Math.round(biggest.share * 100)} % de tes charges). C&apos;est là qu&apos;un effort
              pèse le plus sur ta{" "}
              <Explain k="marge_nette" className="text-[var(--accent-primary)]">
                rentabilité
              </Explain>
              .
            </CopiloteNote>
          </div>
        </section>
      )}

      {/* La notion du moment */}
      {notion && (
        <Explain k={notionKey} variant="plain" className="block w-full text-left">
          <div className="flex items-center justify-between border border-[var(--border-strong)] bg-[var(--accent-primary-soft)] p-4">
            <div className="pr-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--accent-primary)]">
                La notion du moment
              </p>
              <p className="mt-1 text-[15px] font-bold text-primary">{notion.title}</p>
              <p className="mt-0.5 text-[13px] text-secondary">{notion.definition}</p>
            </div>
            <ChevronRight size={20} className="shrink-0 text-[var(--accent-primary)]" />
          </div>
        </Explain>
      )}

      {/* Alertes */}
      {(underThreshold.length > 0 || declining.length > 0) && (
        <section className="space-y-2">
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
        </section>
      )}

      {/* Tes chevaux */}
      {best && worst && (
        <CopiloteNote>
          {worst.net < 0 ? (
            <>
              {worst.horse.name} passe sous son{" "}
              <Explain k="seuil_rentabilite" className="text-[var(--accent-primary)]">
                seuil
              </Explain>{" "}
              sur la période. {best.horse.name}, lui, te porte avec {eur(best.net)}.
            </>
          ) : (
            <>
              {best.horse.name} mène la danse avec {eur(best.net)}. Regarde quand même{" "}
              {worst.horse.name}, ton plus juste.
            </>
          )}
        </CopiloteNote>
      )}

      <section>
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
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  explain,
  divider,
}: {
  label: string;
  value: string;
  explain: string;
  divider?: boolean;
}) {
  return (
    <div className={`px-2 py-3 ${divider ? "border-l border-[var(--border-default)]" : ""}`}>
      <Explain k={explain} className="text-[10px] font-bold uppercase leading-tight tracking-wide text-tertiary">
        {label}
      </Explain>
      <p className="mt-1 text-[15px] font-extrabold tabular-nums text-primary">{value}</p>
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
