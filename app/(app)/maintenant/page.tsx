"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, Coins, Receipt, Camera, ChevronRight } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { KeyNumber } from "@/components/ui/key-number";
import { Sparkline } from "@/components/ui/sparkline";
import { LessonTerm } from "@/components/pedagogy/lesson-term";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { useHorses } from "@/lib/hooks/use-horses";
import { stableMarginSeries, stablePnl } from "@/lib/domain/calculations";
import { bestInsight } from "@/lib/domain/insights-engine";
import { formatLongDate } from "@/lib/utils/format-date";
import { formatEur } from "@/lib/utils/format-currency";

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
  const underThreshold = horses.filter((h) => h.pnl.netResult < 0);
  const declining = horses.filter((h) => h.trend === "baisse");
  const insight = bestInsight(data, period);

  const quickActions = [
    { label: "Encaisser une pension", href: "/saisie/revenu", icon: <Coins size={18} /> },
    { label: "Saisir un foin pour tout le monde", href: "/saisie/mutualisee", icon: <Receipt size={18} /> },
    { label: "Photo d'une facture", href: "/saisie/charge?mode=photo", icon: <Camera size={18} /> },
  ];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm capitalize text-secondary">
          {formatLongDate(new Date())}
        </p>
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">
          Bonjour.
        </h1>
      </header>

      {/* Hero metric */}
      <section className="rounded-[var(--radius-lg)] border bg-elevated p-5">
        <LessonTerm lessonKey="marge_nette" className="text-2xs uppercase tracking-wide text-tertiary">
          Marge nette du mois
        </LessonTerm>
        <div className="mt-1">
          <KeyNumber value={pnl.netResult} colorBySign className="text-5xl" />
        </div>
        <div className="mt-3">
          <Sparkline data={series} area width={420} height={48} className="w-full" />
        </div>
        <div className="mt-3 flex justify-between text-2xs text-tertiary">
          <span>{formatEur(pnl.revenue)} de revenus</span>
          <span>{pnl.horseCount} chevaux</span>
        </div>
      </section>

      {/* Alerts */}
      {(underThreshold.length > 0 || declining.length > 0) && (
        <section className="space-y-2">
          {underThreshold.length > 0 && (
            <AlertCard
              href="/ecurie"
              tone="danger"
              text={`${underThreshold.length} cheval${underThreshold.length > 1 ? "x" : ""} sous le seuil ce mois`}
            />
          )}
          {declining.slice(0, 1).map((h) => (
            <AlertCard
              key={h.horse.id}
              href={`/cheval/${h.horse.id}`}
              tone="warning"
              text={`${h.horse.name} perd en marge ces derniers mois`}
            />
          ))}
        </section>
      )}

      {/* Weekly discovery */}
      {insight && (
        <Link href="/decouvertes">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[var(--radius-lg)] border bg-gradient-to-br from-[var(--accent-primary-soft)] to-transparent p-5"
          >
            <p className="text-2xs uppercase tracking-wide text-[var(--accent-primary)]">
              La découverte de la semaine
            </p>
            <p className="mt-1.5 font-[family-name:var(--font-fraunces)] text-lg text-primary">
              {insight.title}
            </p>
            <p className="mt-1 text-sm text-secondary line-clamp-2">{insight.body}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-2xs text-[var(--accent-primary)]">
              Voir le détail <ChevronRight size={13} />
            </span>
          </motion.section>
        </Link>
      )}

      {/* Quick actions */}
      <section>
        <h2 className="mb-2 text-2xs uppercase tracking-wide text-tertiary">
          Actions rapides
        </h2>
        <div className="space-y-2">
          {quickActions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border bg-elevated p-3.5 active:bg-[var(--bg-pressed)]"
            >
              <span className="text-[var(--accent-primary)]">{a.icon}</span>
              <span className="flex-1 text-sm text-primary">{a.label}</span>
              <ChevronRight size={16} className="text-tertiary" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function AlertCard({
  href,
  tone,
  text,
}: {
  href: string;
  tone: "danger" | "warning";
  text: string;
}) {
  const color = tone === "danger" ? "var(--c-danger)" : "var(--c-warning)";
  const bg = tone === "danger" ? "var(--c-danger-soft)" : "var(--c-warning-soft)";
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[var(--radius-md)] p-3.5"
      style={{ background: bg }}
    >
      <AlertTriangle size={18} style={{ color }} />
      <span className="flex-1 text-sm text-primary">{text}</span>
      <ChevronRight size={16} style={{ color }} />
    </Link>
  );
}
