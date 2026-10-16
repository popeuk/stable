"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ClientGate } from "@/components/ui/client-gate";
import { cap } from "@/components/bs/ui";
import { Face, Hello, Money, Page, eur } from "@/components/carnet/ui";
import { useHorses } from "@/lib/hooks/use-horses";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { useUiStore } from "@/stores/ui-store";
import { stablePnl } from "@/lib/domain/calculations";
import { addMonths } from "@/lib/utils/period";
import { formatMonthName, formatMonthYear } from "@/lib/utils/format-date";

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
  const say = useUiStore((s) => s.say);
  const [index, setIndex] = useState(0);

  const sorted = [...horses].sort((a, b) => b.pnl.netResult - a.pnl.netResult);
  const hero = sorted[0];
  const worry = sorted[sorted.length - 1];

  const now = stablePnl(data, period);
  const prev = stablePnl(data, addMonths(period, -1));
  const lastYear = stablePnl(data, addMonths(period, -12));

  // Heaviest shared expense this month.
  const monthShared = data.sharedExpenses.filter((s) => s.periodYear === period.year && s.periodMonth === period.month);
  const heaviest = monthShared.length ? monthShared.reduce((a, b) => (b.totalAmount > a.totalAmount ? b : a)) : null;

  if (horses.length === 0) {
    return (
      <Page>
        <Hello title="Audit mensuel" sub="Pas encore de données à auditer." />
      </Page>
    );
  }

  const cards: Card[] = [
    {
      tag: "Le héros du mois",
      render: (
        <>
          <Face horse={hero.horse} />
          <p className="mid">{hero.horse.name}</p>
          <p className="note">Ton meilleur cheval ce mois</p>
          <p className="big">
            <Money v={hero.pnl.netResult} />
          </p>
        </>
      ),
    },
    {
      tag: "L’inquiétude",
      render: (
        <>
          <Face horse={worry.horse} />
          <p className="mid">{worry.horse.name}</p>
          <p className="note">Celui qui pèse le plus</p>
          <p className="big">
            <Money v={worry.pnl.netResult} />
          </p>
        </>
      ),
    },
    {
      tag: "Bilan global",
      render: (
        <>
          <p className="note">Résultat de {formatMonthName(period)}</p>
          <p className="big">
            <Money v={now.netResult} />
          </p>
          <p className="note" style={{ marginTop: 18 }}>
            Mois précédent : <Money v={prev.netResult} />
            <br />
            Même mois l’an dernier : <Money v={lastYear.netResult} />
          </p>
        </>
      ),
    },
    {
      tag: "Le poste à surveiller",
      render: (
        <>
          <p className="note">Charge mutualisée la plus lourde</p>
          <p className="mid">{heaviest?.label ?? "Aucune"}</p>
          <p className="big">{heaviest ? <Money v={-heaviest.totalAmount} /> : eur(0)}</p>
          <p className="note">répartis sur toute l’écurie</p>
        </>
      ),
    },
    {
      tag: "Suggestion d’action",
      render: (
        <>
          <p className="note">À tester ce mois</p>
          <p className="mid" style={{ maxWidth: 320 }}>
            {worry.pnl.netResult < 0 ? `Et si tu réalignais la pension de ${worry.horse.name} à son prochain renouvellement ?` : "Et si tu indexais tes pensions sur tes coûts ?"}
          </p>
          <Link href={`/scenarios/nouveau?horse=${worry.horse.id}`} className="btn" style={{ marginTop: 18 }}>
            Ouvrir le scénario
          </Link>
        </>
      ),
    },
  ];

  const card = cards[index];

  return (
    <Page>
      <h1 className="ar-sr">Audit mensuel</h1>
      <Hello title={cap(formatMonthYear(period))} sub="Audit mensuel. Fais glisser les cartes." />

      <div className="ar-swipe">
        <MotionConfig reducedMotion="user">
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
            >
              <div className="card">
                <p className="k">{card.tag}</p>
                <div className="ar-body">{card.render}</div>
              </div>
            </motion.div>
          </AnimatePresence>
        </MotionConfig>
      </div>

      <div className="ar-dots">
        {cards.map((_, i) => (
          <button key={i} type="button" onClick={() => setIndex(i)} aria-label={`Carte ${i + 1}`} aria-current={i === index}>
            <i />
          </button>
        ))}
      </div>

      {index === cards.length - 1 && (
        <div className="pad" style={{ marginTop: 14 }}>
          <button type="button" onClick={() => say("Image résumé générée (démo).")} className="btn line full">
            Partager le bilan
          </button>
        </div>
      )}
      <div className="end" />
    </Page>
  );
}
