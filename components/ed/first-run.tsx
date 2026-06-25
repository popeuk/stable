"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, ArrowRight, Minus, Plus } from "lucide-react";
import { HorseLine } from "@/components/ed/atoms";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * The from-zero welcome. Shown on the home until the stable has at least a
 * horse and a first money entry — guiding the very first steps instead of an
 * empty dashboard.
 */
export function FirstRun() {
  const data = useDataStore();
  const capacity = useSettingsStore((s) => s.capacity);
  const setCapacity = useSettingsStore((s) => s.setCapacity);

  const hasHorses = data.horses.some((h) => !h.isArchived);
  const hasRevenue = data.revenues.length > 0 || (data.recurringRevenues?.length ?? 0) > 0;
  const hasExpense =
    data.directExpenses.length > 0 ||
    data.sharedExpenses.length > 0 ||
    (data.recurringExpenses?.length ?? 0) > 0;

  const steps = [
    {
      n: 1,
      title: "Ajoute ton premier cheval",
      sub: "Nom, race, propriétaire — l'essentiel.",
      done: hasHorses,
      href: "/saisie/cheval",
      cta: "Ajouter",
      enabled: true,
    },
    {
      n: 2,
      title: "Encaisse une première pension",
      sub: "Le revenu de base de ton écurie.",
      done: hasRevenue,
      href: "/saisie/revenu",
      cta: "Saisir",
      enabled: hasHorses,
    },
    {
      n: 3,
      title: "Note une première charge",
      sub: "Foin, maréchal, véto… ou un crédit récurrent.",
      done: hasExpense,
      href: "/saisie/charge",
      cta: "Saisir",
      enabled: hasHorses,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden border border-[var(--border-strong)] bg-elevated p-5"
      >
        <HorseLine
          size={130}
          stroke={0.8}
          color="var(--border-default)"
          className="pointer-events-none absolute -right-3 -top-3"
        />
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--accent-primary)]">
          Bienvenue
        </p>
        <h1 className="mt-1 max-w-[18rem] font-[family-name:var(--font-fraunces)] text-2xl leading-tight text-primary">
          Construisons ton écurie, étape par étape.
        </h1>
        <p className="mt-2 max-w-[20rem] text-[14px] text-secondary">
          En 3 minutes, tu verras quel cheval te rapporte vraiment et où part ton argent. On commence.
        </p>
      </motion.div>

      {/* Capacité */}
      <div className="flex items-center justify-between border border-[var(--border-strong)] bg-elevated p-4">
        <div>
          <p className="text-[14px] font-bold text-primary">Combien de places as-tu ?</p>
          <p className="text-[12px] text-tertiary">Ta capacité d&apos;accueil — le levier n°1.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCapacity(capacity - 1)}
            aria-label="moins"
            className="flex size-8 items-center justify-center border border-[var(--border-strong)] text-primary"
          >
            <Minus size={15} />
          </button>
          <span className="w-7 text-center text-lg font-extrabold tabular-nums text-primary">
            {capacity}
          </span>
          <button
            onClick={() => setCapacity(capacity + 1)}
            aria-label="plus"
            className="flex size-8 items-center justify-center border border-[var(--border-strong)] bg-[var(--accent-primary)] text-[#17150d]"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[12px] font-semibold text-tertiary">
          <span>Tes premières étapes</span>
          <span className="tabular-nums">{doneCount}/3</span>
        </div>
        <div className="h-1.5 bg-[var(--bg-pressed)]">
          <motion.div
            className="h-full bg-[var(--accent-primary)]"
            initial={{ width: 0 }}
            animate={{ width: `${(doneCount / 3) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((s) => (
          <div
            key={s.n}
            className="flex items-center gap-3 border border-[var(--border-strong)] bg-elevated p-4"
            style={{ opacity: s.enabled || s.done ? 1 : 0.5 }}
          >
            <span
              className="flex size-7 shrink-0 items-center justify-center border text-[13px] font-bold tabular-nums"
              style={{
                borderColor: s.done ? "var(--c-success)" : "var(--border-strong)",
                background: s.done ? "var(--c-success)" : "transparent",
                color: s.done ? "#fff" : "var(--text-tertiary)",
              }}
            >
              {s.done ? <Check size={15} /> : s.n}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold leading-tight text-primary">{s.title}</p>
              <p className="text-[12px] text-tertiary">{s.sub}</p>
            </div>
            {!s.done && s.enabled && (
              <Link
                href={s.href}
                className="flex shrink-0 items-center gap-1.5 border border-[var(--text-primary)] bg-[var(--accent-primary)] px-3 py-1.5 text-[13px] font-bold text-[#17150d]"
              >
                {s.cta} <ArrowRight size={14} />
              </Link>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-[12px] text-tertiary">
        Dès ton premier cheval et ta première saisie, ton tableau de bord apparaît ici.
      </p>
    </div>
  );
}
