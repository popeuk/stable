"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { CareIcon, DeadlineRow } from "@/components/ed/care-bits";
import { useDataStore } from "@/stores/data-store";
import { upcomingDeadlines, CARE_META, type Deadline } from "@/lib/domain/care";
import { formatEur } from "@/lib/utils/format-currency";
import { cn } from "@/lib/utils/cn";

/**
 * Le Planning : le temps de l'écurie, anticipé. Les échéances (vaccins,
 * ferrures, vermifuges…) se calculent toutes seules à partir du carnet ;
 * « Fait ✓ » replanifie la suivante. L'onglet Carnet garde toute l'histoire.
 */
type View = "avenir" | "carnet";

function shortDate(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export default function PlanningPage() {
  return (
    <ClientGate>
      <Planning />
    </ClientGate>
  );
}

function Planning() {
  const data = useDataStore();
  const deleteCareEvent = useDataStore((s) => s.deleteCareEvent);
  const [view, setView] = useState<View>("avenir");
  const today = new Date().toISOString().slice(0, 10);

  const horseName = (id: string) =>
    data.horses.find((h) => h.id === id)?.name ?? "cheval retiré";

  const deadlines = useMemo(
    () => upcomingDeadlines(data, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.careEvents, data.horses, today],
  );
  const groups: { title: string; items: Deadline[] }[] = [
    { title: "En retard", items: deadlines.filter((d) => d.status === "overdue") },
    { title: "Sous 14 jours", items: deadlines.filter((d) => d.status === "soon") },
    { title: "Plus tard", items: deadlines.filter((d) => d.status === "ok").slice(0, 12) },
  ].filter((g) => g.items.length > 0);

  const log = useMemo(
    () =>
      [...(data.careEvents ?? [])]
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 40),
    [data.careEvents],
  );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">Planning</h1>
        <Link
          href="/saisie/soin"
          className="flex items-center gap-1 btn-primary px-3 py-1.5 text-[12px] font-bold text-[var(--on-accent)]"
        >
          <Plus size={14} /> Noter un soin
        </Link>
      </header>

      {/* Vue */}
      <div className="grid grid-cols-2 overflow-hidden rounded-full border border-[var(--border-strong)]">
        {(
          [
            { v: "avenir", l: "À prévoir" },
            { v: "carnet", l: "Le carnet" },
          ] as { v: View; l: string }[]
        ).map((o) => (
          <button
            key={o.v}
            onClick={() => setView(o.v)}
            className={cn("py-2.5 text-[14px] font-bold transition-colors")}
            style={{
              background: view === o.v ? "var(--ink)" : "transparent",
              color: view === o.v ? "var(--on-ink)" : "var(--text-primary)",
            }}
          >
            {o.l}
          </button>
        ))}
      </div>

      {view === "avenir" ? (
        groups.length === 0 ? (
          <div className="card p-5 text-center">
            <p className="text-[15px] font-bold text-primary">Rien à anticiper pour l&apos;instant.</p>
            <p className="mt-1 text-[13px] text-secondary">
              Note un premier acte (vaccin, ferrure, vermifuge…) et je calculerai les suivants
              tout seul.
            </p>
            <Link
              href="/saisie/soin"
              className="mt-4 inline-flex items-center gap-1.5 btn-primary px-4 py-2 text-[13px] text-[var(--on-accent)]"
            >
              <Plus size={14} /> Noter un soin
            </Link>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.title}>
              <h2 className="title-serif mb-1 text-[19px] text-primary">{g.title}</h2>
              <ul>
                <AnimatePresence initial={false}>
                  {g.items.map((d) => (
                    <DeadlineRow
                      key={`${d.horseId}-${d.kind}`}
                      d={d}
                      horseName={horseName(d.horseId)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))
        )
      ) : log.length === 0 ? (
        <p className="py-10 text-center text-sm text-tertiary">
          Le carnet est vide. Chaque soin noté s&apos;inscrit ici, pour toute l&apos;écurie.
        </p>
      ) : (
        <ul>
          {log.map((e, i) => (
            <motion.li
              key={e.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.03, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3 border-b border-[var(--border-default)] py-3"
            >
              <span className="w-11 shrink-0 text-[11px] font-semibold text-tertiary">
                {shortDate(e.date)}
              </span>
              <span className="shrink-0 text-tertiary">
                <CareIcon kind={e.kind} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold leading-tight text-primary">
                  {CARE_META[e.kind].label} · {horseName(e.horseId)}
                </p>
                <p className="truncate text-[12px] text-tertiary">
                  {e.label ?? ""}
                  {e.provider ? `${e.label ? " · " : ""}${e.provider}` : ""}
                </p>
              </div>
              {e.cost ? (
                <span className="text-[13px] font-bold tabular-nums text-primary">
                  −{formatEur(e.cost)}
                </span>
              ) : null}
              <button
                onClick={() =>
                  confirm("Supprimer cet acte du carnet (et sa dépense liée) ?") &&
                  deleteCareEvent(e.id)
                }
                aria-label="Supprimer"
                className="shrink-0 p-1 text-tertiary hover:text-[var(--c-danger)]"
              >
                <Trash2 size={15} />
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
