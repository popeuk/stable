"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Trash2, Repeat } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { RangeSelector } from "@/components/ed/range-selector";
import { Explain } from "@/components/ed/explain";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { periodStart, rangePeriods } from "@/lib/utils/period";
import { aggregateStablePnl } from "@/lib/domain/calculations";
import { cn } from "@/lib/utils/cn";
import { formatEur } from "@/lib/utils/format-currency";

/**
 * The Journal: every euro in and out, in one list. The owner's paper notebook,
 * digitised — including the ability to fix a wrong entry (delete both sides).
 */
interface Row {
  id: string;
  date: string;
  label: string;
  target: string;
  amount: number;
  kind: "revenue" | "direct" | "shared";
}

type Filter = "tout" | "entrees" | "sorties";

function shortDate(iso: string) {
  return format(new Date(iso + "T00:00:00"), "d MMM", { locale: fr });
}

function freqLabel(f: string) {
  return f === "monthly" ? "chaque mois" : f === "quarterly" ? "tous les 3 mois" : "chaque année";
}

export default function JournalPage() {
  return (
    <ClientGate>
      <Journal />
    </ClientGate>
  );
}

function Journal() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const preset = usePeriodStore((s) => s.preset);
  const periods = useMemo(() => rangePeriods(active, preset), [active, preset]);
  const deleteRevenue = useDataStore((s) => s.deleteRevenue);
  const deleteDirect = useDataStore((s) => s.deleteDirectExpense);
  const deleteShared = useDataStore((s) => s.deleteSharedExpense);
  const deleteRecurring = useDataStore((s) => s.deleteRecurringExpense);
  const deleteRecurringRevenue = useDataStore((s) => s.deleteRecurringRevenue);
  const [filter, setFilter] = useState<Filter>("tout");

  const recurrings = useMemo(() => data.recurringExpenses ?? [], [data.recurringExpenses]);
  const recurringRevs = useMemo(() => data.recurringRevenues ?? [], [data.recurringRevenues]);

  const horseName = (id: string) => data.horses.find((h) => h.id === id)?.name ?? "cheval retiré";
  const catName = (id?: string) => data.revenueCategories.find((c) => c.id === id)?.name;

  const rows = useMemo<Row[]>(() => {
    const inRange = (y: number, m: number) => periods.some((p) => p.year === y && p.month === m);
    const out: Row[] = [];
    for (const r of data.revenues) {
      const y = Number(r.date.slice(0, 4));
      const m = Number(r.date.slice(5, 7));
      if (!inRange(y, m)) continue;
      out.push({
        id: r.id,
        date: r.date,
        label: catName(r.categoryId) ?? "Rentrée d’argent",
        target: horseName(r.horseId),
        amount: r.amount,
        kind: "revenue",
      });
    }
    for (const e of data.directExpenses) {
      const y = Number(e.date.slice(0, 4));
      const m = Number(e.date.slice(5, 7));
      if (!inRange(y, m)) continue;
      out.push({ id: e.id, date: e.date, label: e.label, target: horseName(e.horseId), amount: e.amount, kind: "direct" });
    }
    for (const s of data.sharedExpenses) {
      if (!inRange(s.periodYear, s.periodMonth)) continue;
      out.push({
        id: s.id,
        date: periodStart({ year: s.periodYear, month: s.periodMonth }),
        label: s.label,
        target: `Frais communs · partagés entre ${s.allocations.length} chevaux`,
        amount: s.totalAmount,
        kind: "shared",
      });
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.revenues, data.directExpenses, data.sharedExpenses, periods]);

  const visible = rows.filter((r) =>
    filter === "tout" ? true : filter === "entrees" ? r.kind === "revenue" : r.kind !== "revenue",
  );

  // The same aggregation as the home equation — the two screens always agree.
  const agg = useMemo(() => aggregateStablePnl(data, periods), [data, periods]);

  function remove(r: Row) {
    if (!confirm(`Supprimer « ${r.label} » (${formatEur(r.amount)}) ? Cette ligne disparaîtra de tes comptes.`)) return;
    if (r.kind === "revenue") deleteRevenue(r.id);
    else if (r.kind === "direct") deleteDirect(r.id);
    else deleteShared(r.id);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-bricolage)] text-2xl text-primary">Entrées et sorties d’argent</h1>
      </header>
      <p className="text-sm text-tertiary">Tout ce qui est rentré et sorti, ligne par ligne. Tu peux supprimer une ligne notée par erreur.</p>

      <RangeSelector />

      {/* Totaux identiques à l'équation de l'accueil */}
      <div className="grid grid-cols-3 divide-x divide-[var(--border-default)] card">
        <div className="p-3">
          <Explain k="chiffre_affaires" className="text-[10px] font-bold uppercase tracking-wide text-tertiary">
            Ce qui rentre
          </Explain>
          <p className="mt-0.5 text-[17px] font-extrabold tabular-nums" style={{ color: "var(--c-success)" }}>
            {formatEur(agg.revenue)}
          </p>
        </div>
        <div className="p-3">
          <Explain k="depenses" className="text-[10px] font-bold uppercase tracking-wide text-tertiary">
            Ce qui sort
          </Explain>
          <p className="mt-0.5 text-[17px] font-extrabold tabular-nums text-primary">
            {formatEur(agg.charges)}
          </p>
        </div>
        <div className="p-3">
          <Explain k="marge_nette" className="text-[10px] font-bold uppercase tracking-wide text-tertiary">
            Ce qui te reste
          </Explain>
          <p
            className="mt-0.5 text-[17px] font-extrabold tabular-nums"
            style={{ color: agg.netResult >= 0 ? "var(--c-success)" : "var(--c-danger)" }}
          >
            {formatEur(agg.netResult)}
          </p>
        </div>
      </div>

      {/* Filtre */}
      <div className="flex gap-2">
        {(
          [
            { v: "tout", l: "Tout" },
            { v: "entrees", l: "Ce qui rentre" },
            { v: "sorties", l: "Ce qui sort" },
          ] as { v: Filter; l: string }[]
        ).map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] font-bold",
              filter === f.v
                ? "border-[var(--text-primary)] bg-[var(--ink)] text-[var(--on-ink)]"
                : "border-[var(--border-strong)] text-tertiary",
            )}
          >
            {f.l}
          </button>
        ))}
      </div>

      {/* Récurrents actifs (pensions et charges) */}
      {(recurrings.length > 0 || recurringRevs.length > 0) && filter === "tout" && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-tertiary">
              Compté tout seul, chaque mois
            </h2>
            <Link href="/saisie/recurrente" className="text-[12px] font-semibold text-tertiary">
              + Ajouter
            </Link>
          </div>
          <ul className="border-t border-[var(--border-default)]">
            {recurringRevs.map((r) => (
              <li key={r.id} className="flex items-center gap-3 border-b border-[var(--border-default)] py-3">
                <Repeat size={15} className="shrink-0" style={{ color: "var(--c-success)" }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-primary">
                    {r.label ?? "Pension"} · {horseName(r.horseId)}
                  </p>
                  <p className="truncate text-[12px] text-tertiary">
                    rentre {freqLabel(r.frequency)}
                    {r.endDate ? ` · jusqu’au ${shortDate(r.endDate)}` : " · sans date de fin"}
                  </p>
                </div>
                <span className="text-[14px] font-extrabold tabular-nums" style={{ color: "var(--c-success)" }}>
                  +{formatEur(r.amount)}
                </span>
                <button
                  onClick={() => confirm(`Arrêter cette rentrée d’argent qui revient chaque mois ?`) && deleteRecurringRevenue(r.id)}
                  aria-label={`Arrêter ${r.label ?? "la pension"}`}
                  className="shrink-0 p-1 text-tertiary transition-colors hover:text-[var(--c-danger)]"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
            {recurrings.map((r) => (
              <li key={r.id} className="flex items-center gap-3 border-b border-[var(--border-default)] py-3">
                <Repeat size={15} className="shrink-0 text-[var(--accent-primary)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-primary">{r.label}</p>
                  <p className="truncate text-[12px] text-tertiary">
                    {freqLabel(r.frequency)} · {r.isShared ? "frais communs" : "pour 1 cheval"}
                    {r.endDate ? ` · jusqu’au ${shortDate(r.endDate)}` : " · sans date de fin"}
                  </p>
                </div>
                <span className="text-[14px] font-extrabold tabular-nums text-primary">
                  −{formatEur(r.amount)}
                </span>
                <button
                  onClick={() => confirm(`Arrêter « ${r.label} » ? Elle ne sera plus comptée chaque mois.`) && deleteRecurring(r.id)}
                  aria-label={`Arrêter ${r.label}`}
                  className="shrink-0 p-1 text-tertiary transition-colors hover:text-[var(--c-danger)]"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mouvements ponctuels */}
      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-tertiary">
          {rows.length > 0
            ? "Rien de ce côté sur cette période."
            : recurrings.length + recurringRevs.length > 0
              ? "Rien d’autre sur cette période. Seul ce qui revient chaque mois est compté."
              : "Rien de noté sur cette période. Ajoute une dépense ou une rentrée d’argent pour la voir ici."}
        </p>
      ) : (
        <ul className="border-t border-[var(--border-default)]">
          {visible.map((r, i) => {
            const isIn = r.kind === "revenue";
            return (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 12) * 0.03, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-3 border-b border-[var(--border-default)] py-3"
              >
                <span className="w-12 shrink-0 text-[11px] font-semibold uppercase text-tertiary">
                  {shortDate(r.date)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-primary">{r.label}</p>
                  <p className="truncate text-[12px] text-tertiary">
                    {r.target}
                  </p>
                </div>
                <span
                  className="text-[15px] font-extrabold tabular-nums"
                  style={{ color: isIn ? "var(--c-success)" : "var(--text-primary)" }}
                >
                  {isIn ? "+" : "−"}
                  {formatEur(r.amount)}
                </span>
                <button
                  onClick={() => remove(r)}
                  aria-label={`Supprimer ${r.label}`}
                  className="shrink-0 p-1 text-tertiary transition-colors hover:text-[var(--c-danger)]"
                >
                  <Trash2 size={16} />
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
