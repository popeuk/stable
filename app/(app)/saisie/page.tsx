"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Check, ChevronLeft, Delete, ArrowRight, Layers } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { HorseAvatar } from "@/components/horse/horse-avatar";
import { useDataStore } from "@/stores/data-store";
import { useFlashStore } from "@/stores/flash-store";
import type { Frequency } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

/**
 * Le composeur : la saisie n'est pas un formulaire, c'est une phrase.
 * « Belle te rapporte 450 € chaque mois. » On tape le montant sur un pavé
 * dédié, on touche deux puces, c'est noté. Zéro champ texte, zéro friction.
 */

type Kind = "revenu" | "charge";
type Rythme = "once" | Frequency;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } },
};

const RYTHMES: { v: Rythme; l: string; phrase: string }[] = [
  { v: "once", l: "Une fois", phrase: "" },
  { v: "monthly", l: "Chaque mois", phrase: "chaque mois" },
  { v: "quarterly", l: "Chaque trimestre", phrase: "chaque trimestre" },
  { v: "yearly", l: "Chaque année", phrase: "chaque année" },
];

export default function SaisiePage() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <Composer />
      </Suspense>
    </ClientGate>
  );
}

function Composer() {
  const router = useRouter();
  const search = useSearchParams();
  const data = useDataStore();
  const addRevenue = useDataStore((s) => s.addRevenue);
  const addRecurringRevenue = useDataStore((s) => s.addRecurringRevenue);
  const addDirectExpense = useDataStore((s) => s.addDirectExpense);
  const addRecurringExpense = useDataStore((s) => s.addRecurringExpense);

  const horses = data.horses.filter((h) => !h.isArchived);
  const presetHorse = search.get("horse");

  const [kind, setKind] = useState<Kind>(search.get("kind") === "charge" ? "charge" : "revenu");
  const [raw, setRaw] = useState("");
  const [horseId, setHorseId] = useState<string | null>(
    presetHorse && horses.some((h) => h.id === presetHorse) ? presetHorse : null,
  );
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [rythme, setRythme] = useState<Rythme>(kind === "revenu" ? "monthly" : "once");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const cats = useMemo(
    () =>
      kind === "revenu"
        ? data.revenueCategories
        : data.expenseCategories.filter((c) => c.isDirect),
    [kind, data.revenueCategories, data.expenseCategories],
  );
  // Un revenu part sur Pension (l'écrasante majorité) ; une dépense n'a PAS
  // de catégorie imposée : le gérant choisit, sinon on n'enregistre pas.
  const cat =
    cats.find((c) => c.id === categoryId) ?? (kind === "revenu" ? cats[0] : undefined);
  const amount = Number(raw.replace(",", ".")) || 0;
  const horse = horses.find((h) => h.id === horseId);
  const canSave = amount > 0 && !!horse && !!cat;

  function press(key: string) {
    if (key === "back") return setRaw((r) => r.slice(0, -1));
    if (key === ",") {
      if (raw.includes(",") || raw === "") return;
      return setRaw((r) => r + ",");
    }
    // Digits: cap at 2 decimals, 6 integer digits.
    const [int = "", dec] = raw.split(",");
    if (dec !== undefined && dec.length >= 2) return;
    if (dec === undefined && int.length >= 6) return;
    setRaw((r) => (r === "0" ? key : r + key));
  }

  function save() {
    if (!canSave || !horse || !cat) return;
    useFlashStore.getState().setFlash({
      kind: kind === "revenu" ? "revenue" : "expense",
      amount,
      label: `${cat.name} · ${horse.name}`,
    });
    if (kind === "revenu") {
      if (rythme === "once") {
        addRevenue({ horseId: horse.id, categoryId: cat.id, amount, date, source: "manual" });
      } else {
        addRecurringRevenue({
          horseId: horse.id,
          categoryId: cat.id,
          amount,
          frequency: rythme,
          startDate: date,
          endDate: null,
          source: "recurring",
        });
      }
    } else {
      if (rythme === "once") {
        addDirectExpense({
          horseId: horse.id,
          categoryId: cat.id,
          label: cat.name,
          amount,
          date,
          source: "manual",
        });
      } else {
        addRecurringExpense({
          label: cat.name,
          amount,
          categoryId: cat.id,
          isShared: false,
          horseId: horse.id,
          frequency: rythme,
          startDate: date,
          endDate: null,
          source: "manual",
        });
      }
    }
    router.push("/maintenant");
  }

  // La phrase vivante.
  const rythmePhrase = RYTHMES.find((r) => r.v === rythme)!.phrase;
  const amountStr =
    amount > 0 ? `${raw.replace(".", ",")} €` : "… €";
  const horseStr = horse?.name ?? "…";
  const catStr = cat?.name ?? "…";

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex min-h-[calc(100dvh-8.5rem)] flex-col"
    >
      <button onClick={() => router.back()} className="inline-flex items-center gap-1 self-start text-sm text-tertiary">
        <ChevronLeft size={16} /> Annuler
      </button>

      {/* Direction */}
      <motion.div variants={item} className="mt-4 grid grid-cols-2 overflow-hidden rounded-full border border-[var(--border-strong)]">
        {(
          [
            { v: "revenu", l: "Ça rentre" },
            { v: "charge", l: "Ça sort" },
          ] as { v: Kind; l: string }[]
        ).map((o) => (
          <button
            key={o.v}
            onClick={() => {
              setKind(o.v);
              setCategoryId(undefined);
              setRythme(o.v === "revenu" ? "monthly" : "once");
            }}
            className="py-2.5 text-[14px] font-bold transition-colors"
            style={{
              background: kind === o.v ? "var(--text-primary)" : "transparent",
              color: kind === o.v ? "var(--on-ink)" : "var(--text-primary)",
            }}
          >
            {o.l}
          </button>
        ))}
      </motion.div>

      {/* La phrase */}
      <motion.p
        variants={item}
        layout
        className="sticky top-0 z-20 -mx-5 mt-4 border-b border-[var(--border-default)] bg-base/95 px-5 py-3 font-[family-name:var(--font-fraunces)] text-[24px] leading-snug text-primary backdrop-blur-md"
      >
        {kind === "revenu" ? (
          <>
            <Piece filled={!!horse}>{horseStr}</Piece> te rapporte{" "}
            <Piece filled={amount > 0} accent>
              {amountStr}
            </Piece>
            {rythmePhrase && <> {rythmePhrase}</>}
            {" "}
            <span className="text-tertiary">({catStr.toLowerCase()})</span>
          </>
        ) : (
          <>
            <Piece filled={!!cat}>{catStr}</Piece> pour <Piece filled={!!horse}>{horseStr}</Piece> te coûte{" "}
            <Piece filled={amount > 0} accent>
              {amountStr}
            </Piece>
            {rythmePhrase && <> {rythmePhrase}</>}
          </>
        )}
        .
      </motion.p>

      {/* Pour qui */}
      <motion.div variants={item} className="mt-5">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-tertiary">
          {kind === "revenu" ? "Qui te le rapporte ?" : "Pour qui ?"}
        </p>
        {horses.length === 0 ? (
          <Link
            href="/saisie/cheval"
            className="flex items-center justify-between border border-dashed border-[var(--border-strong)] px-4 py-3.5"
          >
            <span className="pr-3 text-[13px] text-secondary">Ajoute d&apos;abord un cheval.</span>
            <span className="flex shrink-0 items-center gap-1 text-[13px] font-bold text-[var(--accent-primary)]">
              Ajouter <ArrowRight size={14} />
            </span>
          </Link>
        ) : (
          <div className="flex flex-wrap gap-2">
            {horses.map((h) => (
              <button
                key={h.id}
                onClick={() => setHorseId(h.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-[13px] font-bold",
                  horseId === h.id
                    ? "border-[var(--text-primary)] bg-[var(--ink)] text-[var(--on-ink)]"
                    : "border-[var(--border-strong)] text-primary",
                )}
              >
                <HorseAvatar name={h.name} size={22} />
                {h.name}
              </button>
            ))}
            {kind === "charge" && (
              <Link
                href="/saisie/mutualisee"
                className="flex items-center gap-1.5 border border-dashed border-[var(--border-strong)] px-3 py-1.5 text-[13px] font-bold text-tertiary"
              >
                <Layers size={13} /> Toute l&apos;écurie
              </Link>
            )}
          </div>
        )}
      </motion.div>

      {/* Quoi */}
      <motion.div variants={item} className="mt-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-tertiary">
          C&apos;est quoi ?
        </p>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-semibold",
                cat?.id === c.id
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]"
                  : "border-[var(--border-strong)] text-tertiary",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Rythme + date */}
      <motion.div variants={item} className="mt-4 flex flex-wrap items-center gap-2">
        {RYTHMES.map((r) => (
          <button
            key={r.v}
            onClick={() => setRythme(r.v)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] font-semibold",
              rythme === r.v
                ? "border-[var(--text-primary)] bg-[var(--ink)] text-[var(--on-ink)]"
                : "border-[var(--border-strong)] text-tertiary",
            )}
          >
            {r.l}
          </button>
        ))}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label={rythme === "once" ? "Date" : "À partir du"}
          className="ml-auto border border-[var(--border-default)] bg-transparent px-2 py-1.5 text-[12px] text-secondary outline-none"
        />
      </motion.div>

      {/* Pavé */}
      <motion.div variants={item} className="mt-6 grid flex-1 grid-cols-3 content-end gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--border-default)]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "back"].map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            aria-label={k === "back" ? "Effacer" : k}
            className="flex h-14 items-center justify-center bg-elevated text-[20px] font-semibold text-primary active:bg-[var(--bg-pressed)]"
          >
            {k === "back" ? <Delete size={20} /> : k}
          </button>
        ))}
      </motion.div>

      <motion.button
        variants={item}
        disabled={!canSave}
        onClick={save}
        className="mt-3 flex w-full items-center justify-center gap-2 btn-primary py-4 text-[16px] font-bold text-[var(--on-accent)] transition-opacity disabled:opacity-35"
      >
        <Check size={18} /> C&apos;est noté
      </motion.button>
    </motion.div>
  );
}

function Piece({
  children,
  filled,
  accent,
}: {
  children: React.ReactNode;
  filled: boolean;
  accent?: boolean;
}) {
  return (
    <span
      className="transition-colors"
      style={{
        color: !filled
          ? "var(--text-disabled)"
          : accent
            ? "var(--accent-primary)"
            : "var(--text-primary)",
      }}
    >
      {children}
    </span>
  );
}
