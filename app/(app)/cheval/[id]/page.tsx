"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { HorseAvatar } from "@/components/horse/horse-avatar";
import { KeyNumber } from "@/components/ui/key-number";
import { Sparkline } from "@/components/ui/sparkline";
import { LessonTerm } from "@/components/pedagogy/lesson-term";
import { BreakdownBars } from "@/components/horse/breakdown-bars";
import { useHorses } from "@/lib/hooks/use-horses";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { formatEur } from "@/lib/utils/format-currency";
import { dateInPeriod } from "@/lib/utils/period";

export default function ChevalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ClientGate>
      <Cheval id={id} />
    </ClientGate>
  );
}

function Cheval({ id }: { id: string }) {
  const router = useRouter();
  const horses = useHorses(true);
  const data = useDataStore();
  const period = usePeriodStore((s) => s.active);

  const idx = horses.findIndex((h) => h.horse.id === id);
  if (idx === -1) {
    return <p className="text-secondary">Cheval introuvable.</p>;
  }
  const item = horses[idx];
  const { horse, pnl, trend, series } = item;

  const next = horses[(idx + 1) % horses.length];
  const prev = horses[(idx - 1 + horses.length) % horses.length];

  // Revenue breakdown by category.
  const revByCat = new Map<string, number>();
  for (const r of data.revenues) {
    if (r.horseId !== horse.id || !dateInPeriod(r.date, period)) continue;
    const name = data.revenueCategories.find((c) => c.id === r.categoryId)?.name ?? "Autre";
    revByCat.set(name, (revByCat.get(name) ?? 0) + r.amount);
  }
  const directByCat = new Map<string, number>();
  for (const e of data.directExpenses) {
    if (e.horseId !== horse.id || !dateInPeriod(e.date, period)) continue;
    directByCat.set(e.label, (directByCat.get(e.label) ?? 0) + e.amount);
  }
  // Shared cost contributions.
  const sharedContrib = data.sharedExpenses
    .filter((s) => s.periodYear === period.year && s.periodMonth === period.month)
    .map((s) => ({
      label: s.label,
      amount: s.allocations.find((a) => a.horseId === horse.id)?.allocatedAmount ?? 0,
    }))
    .filter((x) => x.amount > 0);

  const trendIcon =
    trend === "hausse" ? <TrendingUp size={16} /> : trend === "baisse" ? <TrendingDown size={16} /> : <Minus size={16} />;

  return (
    <motion.div
      key={horse.id}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.15}
      onDragEnd={(_, info) => {
        if (info.offset.x < -80) router.push(`/cheval/${next.horse.id}`);
        else if (info.offset.x > 80) router.push(`/cheval/${prev.horse.id}`);
      }}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <Link href="/ecurie" className="inline-flex items-center gap-1 text-sm text-tertiary">
        <ChevronLeft size={16} /> Mon écurie
      </Link>

      <header className="flex items-center gap-4">
        <HorseAvatar name={horse.name} size={64} />
        <div>
          <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-primary">
            {horse.name}
          </h1>
          <p className="text-sm text-tertiary">
            {horse.breed}
            {horse.birthYear ? ` · ${new Date().getFullYear() - horse.birthYear} ans` : ""}
            {horse.ownerName ? ` · ${horse.ownerName}` : ""}
          </p>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-3 gap-2">
        <Kpi label="Résultat net" lesson="marge_nette">
          <KeyNumber value={pnl.netResult} colorBySign className="text-xl" animateOnMount={false} />
        </Kpi>
        <Kpi label="Marge nette" lesson="marge_nette">
          <KeyNumber value={pnl.netMarginPct} format="pct" colorBySign className="text-xl" animateOnMount={false} />
        </Kpi>
        <Kpi label="Tendance">
          <span
            className="flex items-center gap-1 text-base capitalize"
            style={{
              color:
                trend === "hausse" ? "var(--c-success)" : trend === "baisse" ? "var(--c-danger)" : "var(--text-secondary)",
            }}
          >
            {trendIcon} {trend}
          </span>
        </Kpi>
      </section>

      {/* Threshold bar */}
      <section className="rounded-[var(--radius-lg)] border bg-elevated p-4">
        <LessonTerm lessonKey="seuil_rentabilite" className="text-2xs uppercase tracking-wide text-tertiary">
          Seuil de rentabilité
        </LessonTerm>
        <ThresholdBar revenue={pnl.revenue} threshold={pnl.threshold} />
        <div className="mt-2 flex justify-between text-2xs text-tertiary">
          <span>Revenus {formatEur(pnl.revenue)}</span>
          <span>Seuil {formatEur(pnl.threshold)}</span>
        </div>
      </section>

      {/* 12-month chart */}
      <section className="rounded-[var(--radius-lg)] border bg-elevated p-4">
        <p className="mb-2 text-2xs uppercase tracking-wide text-tertiary">12 derniers mois</p>
        <Sparkline data={series} area width={420} height={90} className="w-full" />
      </section>

      {/* Breakdowns */}
      <section className="rounded-[var(--radius-lg)] border bg-elevated p-4">
        <p className="mb-3 text-2xs uppercase tracking-wide text-tertiary">Revenus</p>
        <BreakdownBars items={[...revByCat].map(([label, amount]) => ({ label, amount }))} color="var(--c-success)" />
      </section>

      <section className="rounded-[var(--radius-lg)] border bg-elevated p-4">
        <LessonTerm lessonKey="cout_direct" className="mb-3 block text-2xs uppercase tracking-wide text-tertiary">
          Charges directes
        </LessonTerm>
        <BreakdownBars items={[...directByCat].map(([label, amount]) => ({ label, amount }))} color="var(--accent-primary)" />
      </section>

      <section className="rounded-[var(--radius-lg)] border bg-elevated p-4">
        <LessonTerm lessonKey="charges_mutualisees" className="mb-1 block text-2xs uppercase tracking-wide text-tertiary">
          Part des charges mutualisées
        </LessonTerm>
        <p className="mb-3 text-sm text-secondary">
          {formatEur(pnl.sharedCosts)} attribués ce mois
        </p>
        <BreakdownBars items={sharedContrib} color="var(--c-warning)" />
      </section>

      <p className="text-center text-2xs text-tertiary">
        Glisse pour passer à {next.horse.name} →
      </p>
    </motion.div>
  );
}

function Kpi({
  label,
  lesson,
  children,
}: {
  label: string;
  lesson?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border bg-elevated p-3">
      {lesson ? (
        <LessonTerm lessonKey={lesson} className="text-[10px] uppercase tracking-wide text-tertiary">
          {label}
        </LessonTerm>
      ) : (
        <span className="text-[10px] uppercase tracking-wide text-tertiary">{label}</span>
      )}
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ThresholdBar({ revenue, threshold }: { revenue: number; threshold: number }) {
  const max = Math.max(revenue, threshold, 1);
  const revPct = (revenue / max) * 100;
  const thrPct = (threshold / max) * 100;
  const covers = revenue >= threshold;
  return (
    <div className="relative mt-3 h-3 rounded-full bg-[var(--bg-pressed)]">
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${revPct}%`,
          background: covers ? "var(--c-success)" : "var(--c-danger)",
        }}
      />
      <div
        className="absolute inset-y-[-3px] w-0.5 bg-[var(--text-primary)]"
        style={{ left: `${thrPct}%` }}
        title="Seuil"
      />
    </div>
  );
}
