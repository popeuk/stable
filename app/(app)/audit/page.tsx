"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ClientGate } from "@/components/ui/client-gate";
import { KeyNumber } from "@/components/ui/key-number";
import { HorseAvatar } from "@/components/horse/horse-avatar";
import { useHorses } from "@/lib/hooks/use-horses";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { stablePnl } from "@/lib/domain/calculations";
import { addMonths } from "@/lib/utils/period";
import { formatMonthName, formatMonthYear } from "@/lib/utils/format-date";
import { formatEur } from "@/lib/utils/format-currency";

interface Card {
  tag: string;
  render: React.ReactNode;
}

export default function AuditPage() {
  return (
    <ClientGate>
      <Audit />
    </ClientGate>
  );
}

function Audit() {
  const horses = useHorses();
  const data = useDataStore();
  const period = usePeriodStore((s) => s.active);
  const [index, setIndex] = useState(0);

  const sorted = [...horses].sort((a, b) => b.pnl.netResult - a.pnl.netResult);
  const hero = sorted[0];
  const worry = sorted[sorted.length - 1];

  const now = stablePnl(data, period);
  const prev = stablePnl(data, addMonths(period, -1));
  const lastYear = stablePnl(data, addMonths(period, -12));

  // Heaviest shared expense this month.
  const monthShared = data.sharedExpenses.filter(
    (s) => s.periodYear === period.year && s.periodMonth === period.month,
  );
  const heaviest = monthShared.length
    ? monthShared.reduce((a, b) => (b.totalAmount > a.totalAmount ? b : a))
    : null;

  if (horses.length === 0) {
    return <p className="text-secondary">Pas encore de données à auditer.</p>;
  }

  const cards: Card[] = [
    {
      tag: "Le héros du mois",
      render: (
        <CardBody accent="var(--c-success)">
          <HorseAvatar name={hero.horse.name} size={72} />
          <h2 className="mt-4 font-[family-name:var(--font-fraunces)] text-3xl text-primary">
            {hero.horse.name}
          </h2>
          <p className="mt-1 text-sm text-secondary">Ton meilleur cheval ce mois</p>
          <KeyNumber value={hero.pnl.netResult} colorBySign className="mt-4 text-4xl" />
        </CardBody>
      ),
    },
    {
      tag: "L'inquiétude",
      render: (
        <CardBody accent="var(--c-danger)">
          <HorseAvatar name={worry.horse.name} size={72} />
          <h2 className="mt-4 font-[family-name:var(--font-fraunces)] text-3xl text-primary">
            {worry.horse.name}
          </h2>
          <p className="mt-1 text-sm text-secondary">Celui qui pèse le plus</p>
          <KeyNumber value={worry.pnl.netResult} colorBySign className="mt-4 text-4xl" />
        </CardBody>
      ),
    },
    {
      tag: "Bilan global",
      render: (
        <CardBody accent="var(--accent-primary)">
          <p className="text-sm text-secondary">Résultat de {formatMonthName(period)}</p>
          <KeyNumber value={now.netResult} colorBySign className="mt-2 text-5xl" />
          <div className="mt-6 space-y-1 text-sm text-secondary">
            <p>Mois précédent : {formatEur(prev.netResult)}</p>
            <p>Même mois l&apos;an dernier : {formatEur(lastYear.netResult)}</p>
          </div>
        </CardBody>
      ),
    },
    {
      tag: "Le poste à surveiller",
      render: (
        <CardBody accent="var(--c-warning)">
          <p className="text-sm text-secondary">Charge mutualisée la plus lourde</p>
          <h2 className="mt-2 font-[family-name:var(--font-fraunces)] text-3xl text-primary">
            {heaviest?.label ?? "—"}
          </h2>
          <KeyNumber value={heaviest?.totalAmount ?? 0} className="mt-3 text-4xl" />
          <p className="mt-2 text-sm text-tertiary">répartis sur toute l&apos;écurie</p>
        </CardBody>
      ),
    },
    {
      tag: "Suggestion d'action",
      render: (
        <CardBody accent="var(--accent-secondary)">
          <p className="text-sm text-secondary">À tester ce mois</p>
          <h2 className="mt-2 max-w-xs font-[family-name:var(--font-fraunces)] text-2xl leading-snug text-primary">
            {worry.pnl.netResult < 0
              ? `Et si tu réalignais la pension de ${worry.horse.name} à son prochain renouvellement ?`
              : "Et si tu indexais tes pensions sur tes coûts ?"}
          </h2>
          <a
            href={`/scenarios/nouveau?horse=${worry.horse.id}`}
            className="mt-6 inline-block btn-primary px-5 py-2.5 text-sm font-bold text-[var(--on-accent)]"
          >
            Ouvrir le scénario
          </a>
        </CardBody>
      ),
    },
  ];

  const card = cards[index];

  return (
    <div className="space-y-4">
      <header>
        <p className="text-2xs uppercase tracking-wide text-tertiary">Audit mensuel</p>
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl capitalize text-primary">
          {formatMonthYear(period)}
        </h1>
      </header>

      <div className="relative h-[60vh] min-h-[400px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60 && index < cards.length - 1) setIndex((i) => i + 1);
              else if (info.offset.x > 60 && index > 0) setIndex((i) => i - 1);
            }}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
          >
            <div className="flex h-full flex-col rounded-[var(--radius-xl)] border bg-elevated p-6">
              <span className="text-2xs uppercase tracking-wide text-[var(--accent-primary)]">
                {card.tag}
              </span>
              {card.render}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-2">
        {cards.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Carte ${i + 1}`}
            className="size-2 rounded-full transition-colors"
            style={{ background: i === index ? "var(--accent-primary)" : "var(--border-strong)" }}
          />
        ))}
      </div>

      {index === cards.length - 1 && (
        <button
          onClick={() => alert("Image résumé générée (démo).")}
          className="w-full rounded-[var(--radius-md)] border py-3 text-sm text-secondary"
        >
          Partager le bilan
        </button>
      )}
    </div>
  );
}

function CardBody({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center">
      <div className="mb-4 h-1 w-10 rounded-full" style={{ background: accent }} />
      {children}
    </div>
  );
}
