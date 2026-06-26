"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, LayoutList, Orbit, Plus } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { HorseGalaxy } from "@/components/horse/horse-galaxy";
import { Explain } from "@/components/ed/explain";
import { CopiloteNote } from "@/components/ed/copilote";
import { Sparkline } from "@/components/ui/sparkline";
import { EmptyState } from "@/components/ui/empty-state";
import { useHorses } from "@/lib/hooks/use-horses";
import { useSettingsStore } from "@/stores/settings-store";
import { formatEur } from "@/lib/utils/format-currency";
import { cn } from "@/lib/utils/cn";

type Sort = "marge" | "volatilite" | "nom";

export default function EcuriePage() {
  return (
    <ClientGate>
      <Ecurie />
    </ClientGate>
  );
}

function Ecurie() {
  const horses = useHorses();
  const capacity = useSettingsStore((s) => s.capacity);
  const [sort, setSort] = useState<Sort>("marge");
  const [galaxy, setGalaxy] = useState(false);

  const sorted = [...horses].sort((a, b) => {
    if (sort === "nom") return a.horse.name.localeCompare(b.horse.name);
    if (sort === "volatilite") return b.volatility - a.volatility;
    return b.pnl.netResult - a.pnl.netResult;
  });

  const under = horses.filter((h) => h.pnl.netResult < 0).length;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">Mon écurie</h1>
          <Explain k="taux_occupation" variant="plain" className="mt-0.5 block text-left">
            <span className="text-[13px] font-semibold text-tertiary">
              {horses.length} / {capacity} places
              {horses.length < capacity && (
                <span className="ml-1.5 text-[var(--accent-primary)]">
                  · {capacity - horses.length} libre{capacity - horses.length > 1 ? "s" : ""}
                </span>
              )}
            </span>
          </Explain>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGalaxy((g) => !g)}
            className="flex items-center gap-1.5 border border-[var(--border-strong)] px-2.5 py-1.5 text-[12px] font-bold"
            aria-label={galaxy ? "Vue liste" : "Vue galaxie"}
          >
            {galaxy ? <LayoutList size={15} /> : <Orbit size={15} />}
            {galaxy ? "Liste" : "Galaxie"}
          </button>
          <Link
            href="/saisie/cheval"
            className="flex items-center gap-1 border border-[var(--text-primary)] bg-[var(--accent-primary)] px-2.5 py-1.5 text-[12px] font-bold text-[#17150d]"
          >
            <Plus size={14} /> Cheval
          </Link>
        </div>
      </header>

      {horses.length === 0 ? (
        <EmptyState
          title="Aucun cheval pour l'instant."
          body="Ajoute le premier pour voir tes chiffres prendre vie."
          action={
            <Link
              href="/saisie/cheval"
              className="bg-[var(--text-primary)] px-5 py-2.5 text-sm font-bold text-[var(--bg-base)]"
            >
              Ajouter un cheval
            </Link>
          }
        />
      ) : galaxy ? (
        <div className="border border-[var(--border-strong)] bg-elevated p-3">
          <HorseGalaxy items={horses} />
        </div>
      ) : (
        <>
          {under > 0 && (
            <CopiloteNote>
              {under} cheval{under > 1 ? "x" : ""} {under > 1 ? "sont" : "est"} sous{" "}
              {under > 1 ? "leur" : "son"}{" "}
              <Explain k="seuil_rentabilite" className="text-[var(--accent-primary)]">
                seuil
              </Explain>
              . Trie par rentabilité pour voir qui porte l&apos;écurie et qui pèse dessus.
            </CopiloteNote>
          )}

          <div className="flex gap-2">
            {([
              { v: "marge", l: "Rentabilité" },
              { v: "volatilite", l: "Volatilité" },
              { v: "nom", l: "Nom" },
            ] as { v: Sort; l: string }[]).map((s) => (
              <button
                key={s.v}
                onClick={() => setSort(s.v)}
                className={cn(
                  "border px-3 py-1.5 text-[12px] font-bold",
                  sort === s.v
                    ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)]"
                    : "border-[var(--border-strong)] text-tertiary",
                )}
              >
                {s.l}
              </button>
            ))}
          </div>

          <ul className="border-t border-[var(--border-default)]">
            {sorted.map((h, i) => {
              const ok = h.pnl.netResult >= 0;
              return (
                <li key={h.horse.id}>
                  <Link
                    href={`/cheval?id=${h.horse.id}`}
                    className="flex items-center gap-3 border-b border-[var(--border-default)] py-3.5"
                  >
                    <span className="w-7 text-[13px] font-bold tabular-nums text-tertiary">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-bold leading-tight text-primary">{h.horse.name}</p>
                      <p className="truncate text-[12px] text-tertiary">
                        {h.horse.breed}
                        {h.horse.birthYear ? ` · ${new Date().getFullYear() - h.horse.birthYear} ans` : ""}
                      </p>
                    </div>
                    <Sparkline data={h.series} width={56} height={24} />
                    <span
                      className="w-[68px] text-right text-[15px] font-extrabold tabular-nums"
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
        </>
      )}
    </div>
  );
}
