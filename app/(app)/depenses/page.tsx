"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Trash2, Plus, Layers } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { RangeSelector } from "@/components/ed/range-selector";
import { Explain } from "@/components/ed/explain";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { periodStart, rangePeriods } from "@/lib/utils/period";
import { formatEur } from "@/lib/utils/format-currency";

interface Row {
  id: string;
  date: string;
  label: string;
  target: string;
  amount: number;
  kind: "direct" | "shared";
}

function shortDate(iso: string) {
  return format(new Date(iso + "T00:00:00"), "d MMM", { locale: fr });
}

export default function DepensesPage() {
  return (
    <ClientGate>
      <Depenses />
    </ClientGate>
  );
}

function Depenses() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const preset = usePeriodStore((s) => s.preset);
  const periods = useMemo(() => rangePeriods(active, preset), [active, preset]);
  const deleteDirect = useDataStore((s) => s.deleteDirectExpense);
  const deleteShared = useDataStore((s) => s.deleteSharedExpense);

  const inRange = (y: number, m: number) => periods.some((p) => p.year === y && p.month === m);
  const horseName = (id: string) => data.horses.find((h) => h.id === id)?.name ?? "—";

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
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
        target: `Écurie · ${s.allocations.length} chevaux`,
        amount: s.totalAmount,
        kind: "shared",
      });
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.directExpenses, data.sharedExpenses, periods]);

  const total = rows.reduce((s, r) => s + r.amount, 0);

  function remove(r: Row) {
    if (!confirm(`Supprimer « ${r.label} » (${formatEur(r.amount)}) ?`)) return;
    if (r.kind === "direct") deleteDirect(r.id);
    else deleteShared(r.id);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">Dépenses</h1>
        <Link
          href="/saisie/charge"
          className="flex items-center gap-1.5 border border-[var(--text-primary)] bg-[var(--accent-primary)] px-3 py-1.5 text-[12px] font-bold text-[#17150d]"
        >
          <Plus size={14} /> Ajouter
        </Link>
      </header>

      <RangeSelector />

      <div className="border border-[var(--border-strong)] bg-elevated p-4">
        <Explain k="depenses" className="text-[11px] font-bold uppercase tracking-[0.08em] text-tertiary">
          Total des charges
        </Explain>
        <p className="mt-1 font-[family-name:var(--font-fraunces)] text-3xl tabular-nums text-primary">
          {formatEur(total)}
        </p>
        <p className="mt-0.5 text-[12px] text-tertiary">{rows.length} mouvement{rows.length > 1 ? "s" : ""}</p>
      </div>

      <div className="flex gap-2">
        <Link
          href="/saisie/charge"
          className="flex flex-1 items-center justify-center gap-1.5 border border-[var(--border-strong)] py-2.5 text-[13px] font-bold"
        >
          <Plus size={15} /> Charge directe
        </Link>
        <Link
          href="/saisie/mutualisee"
          className="flex flex-1 items-center justify-center gap-1.5 border border-[var(--border-strong)] py-2.5 text-[13px] font-bold"
        >
          <Layers size={15} /> Mutualisée
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-tertiary">Aucune dépense sur cette période.</p>
      ) : (
        <ul className="border-t border-[var(--border-default)]">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 border-b border-[var(--border-default)] py-3"
            >
              <span className="w-12 shrink-0 text-[11px] font-semibold uppercase text-tertiary">
                {shortDate(r.date)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-primary">{r.label}</p>
                <p className="truncate text-[12px] text-tertiary">
                  {r.target}
                  {r.kind === "shared" ? " · mutualisée" : ""}
                </p>
              </div>
              <span className="text-[15px] font-extrabold tabular-nums text-primary">
                {formatEur(r.amount)}
              </span>
              <button
                onClick={() => remove(r)}
                aria-label={`Supprimer ${r.label}`}
                className="shrink-0 p-1 text-tertiary transition-colors hover:text-[var(--c-danger)]"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
