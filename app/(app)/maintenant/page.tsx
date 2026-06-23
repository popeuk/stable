"use client";

import Link from "next/link";
import { ChevronRight, AlertTriangle, ArrowUpRight } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { Sparkline } from "@/components/ui/sparkline";
import { Explain } from "@/components/ed/explain";
import { CopiloteNote } from "@/components/ed/copilote";
import { SectionHead } from "@/components/ed/atoms";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { useHorses } from "@/lib/hooks/use-horses";
import { stableMarginSeries, stablePnl } from "@/lib/domain/calculations";
import { pickNotion } from "@/lib/domain/notion";
import { LESSONS } from "@/content/lessons";
import { formatLongDate } from "@/lib/utils/format-date";
import { formatEur } from "@/lib/utils/format-currency";

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
  const period = usePeriodStore((s) => s.active);
  const horses = useHorses();

  const pnl = stablePnl(data, period);
  const series = stableMarginSeries(data, period, 12);
  const charges = pnl.directCosts + pnl.sharedCosts;
  const positive = pnl.netResult >= 0;
  const marginPct = pnl.revenue > 0 ? Math.round((pnl.netResult / pnl.revenue) * 100) : 0;

  const underThreshold = horses.filter((h) => h.pnl.netResult < 0);
  const declining = horses.filter((h) => h.trend === "baisse");
  const best = horses[0];
  const worst = horses[horses.length - 1];

  const notionKey = pickNotion(data, period);
  const notion = LESSONS[notionKey];

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[13px] font-semibold capitalize text-tertiary">
          {formatLongDate(new Date())}
        </p>
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">Bonjour.</h1>
      </header>

      {/* Hero — ce que tu gardes, tappable pour comprendre */}
      <section className="border border-[var(--border-strong)] bg-elevated">
        <div className="px-5 pb-4 pt-4">
          <Explain k="marge_nette" className="text-[11px] font-bold uppercase tracking-[0.08em] text-tertiary">
            Ce mois, tu gardes
          </Explain>
          <p
            className="mt-1 font-[family-name:var(--font-fraunces)] text-5xl tabular-nums"
            style={{ color: positive ? "var(--c-success)" : "var(--c-danger)" }}
          >
            {eur(pnl.netResult)}
          </p>
          <div className="mt-3">
            <Sparkline data={series} area width={400} height={44} className="w-full" />
          </div>
        </div>
        <div className="grid grid-cols-3 border-t border-[var(--border-default)] text-center">
          <Stat label="Revenus" value={eur(pnl.revenue)} />
          <Stat label="Charges" value={eur(charges)} divider explain="cout_direct" />
          <Stat label="Marge" value={`${marginPct} %`} divider explain="marge_nette" />
        </div>
      </section>

      {/* Le copilote enseigne, en contexte */}
      {best && worst && (
        <CopiloteNote>
          {worst.pnl.netResult < 0 ? (
            <>
              {worst.horse.name} passe sous son{" "}
              <Explain k="seuil_rentabilite" className="text-[var(--accent-primary)]">
                seuil
              </Explain>{" "}
              ce mois : ses revenus ne couvrent plus son coût de place. {best.horse.name}, lui, te
              porte avec {eur(best.pnl.netResult)}.
            </>
          ) : (
            <>
              Beau mois : {best.horse.name} mène la danse avec {eur(best.pnl.netResult)}. Regarde
              quand même {worst.horse.name}, ton plus juste.
            </>
          )}
        </CopiloteNote>
      )}

      {/* La notion du moment — apprendre, en filigrane */}
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
            <ArrowUpRight size={20} className="shrink-0 text-[var(--accent-primary)]" />
          </div>
        </Explain>
      )}

      {/* Alertes, formulées pour faire comprendre */}
      {(underThreshold.length > 0 || declining.length > 0) && (
        <section className="space-y-2">
          {underThreshold.length > 0 && (
            <AlertRow
              href="/ecurie"
              text={`${underThreshold.length} cheval${underThreshold.length > 1 ? "x" : ""} sous le seuil`}
              hint="leur place coûte plus qu'elle ne rapporte"
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
      <section>
        <SectionHead title="Tes chevaux" action={<Link href="/ecurie">Tout voir ›</Link>} />
        <ul className="border-t border-[var(--border-default)]">
          {horses.slice(0, 4).map((h, i) => {
            const ok = h.pnl.netResult >= 0;
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
                    <p className="text-[12px] text-tertiary">{ok ? "rapporte ce mois" : "te coûte ce mois"}</p>
                  </div>
                  <span
                    className="text-[16px] font-extrabold tabular-nums"
                    style={{ color: ok ? "var(--c-success)" : "var(--c-danger)" }}
                  >
                    {formatEur(h.pnl.netResult)}
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

function Stat({
  label,
  value,
  divider,
  explain,
}: {
  label: string;
  value: string;
  divider?: boolean;
  explain?: string;
}) {
  return (
    <div className={`py-3 ${divider ? "border-l border-[var(--border-default)]" : ""}`}>
      {explain ? (
        <Explain k={explain} className="text-[10px] font-bold uppercase tracking-wide text-tertiary">
          {label}
        </Explain>
      ) : (
        <span className="text-[10px] font-bold uppercase tracking-wide text-tertiary">{label}</span>
      )}
      <p className="mt-0.5 text-[15px] font-extrabold tabular-nums text-primary">{value}</p>
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
