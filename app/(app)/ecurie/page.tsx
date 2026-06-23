"use client";

import { useState } from "react";
import { LayoutGrid, Orbit, Plus } from "lucide-react";
import Link from "next/link";
import { ClientGate } from "@/components/ui/client-gate";
import { HorseCard } from "@/components/horse/horse-card";
import { HorseGalaxy } from "@/components/horse/horse-galaxy";
import { EmptyState } from "@/components/ui/empty-state";
import { useHorses } from "@/lib/hooks/use-horses";
import { cn } from "@/lib/utils/cn";

type View = "gallery" | "galaxy";
type Sort = "marge" | "volatilite" | "nom";

export default function EcuriePage() {
  return (
    <ClientGate>
      <Ecurie />
    </ClientGate>
  );
}

function Ecurie() {
  const [view, setView] = useState<View>("gallery");
  const [sort, setSort] = useState<Sort>("marge");
  const horses = useHorses();

  const sorted = [...horses].sort((a, b) => {
    if (sort === "nom") return a.horse.name.localeCompare(b.horse.name);
    if (sort === "volatilite") return b.volatility - a.volatility;
    return b.pnl.netResult - a.pnl.netResult;
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">
          Mon écurie
        </h1>
        <div className="flex gap-1 rounded-full border bg-elevated p-1">
          <ViewBtn active={view === "gallery"} onClick={() => setView("gallery")}>
            <LayoutGrid size={16} />
          </ViewBtn>
          <ViewBtn active={view === "galaxy"} onClick={() => setView("galaxy")}>
            <Orbit size={16} />
          </ViewBtn>
        </div>
      </header>

      {horses.length === 0 ? (
        <EmptyState
          title="Aucun cheval pour l'instant."
          body="Ajoute le premier pour voir tes chiffres prendre vie."
          icon={<Plus size={22} />}
          action={
            <Link
              href="/saisie/cheval"
              className="rounded-[var(--radius-md)] bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-medium text-[#0e0f0c]"
            >
              Ajouter un cheval
            </Link>
          }
        />
      ) : view === "galaxy" ? (
        <HorseGalaxy items={horses} />
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(["marge", "volatilite", "nom"] as Sort[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs capitalize",
                  sort === s
                    ? "border-[var(--accent-primary)] text-[var(--accent-primary)]"
                    : "text-tertiary",
                )}
              >
                {s === "marge" ? "Rentabilité" : s === "volatilite" ? "Volatilité" : "Nom"}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {sorted.map((item, i) => (
              <HorseCard key={item.horse.id} item={item} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ViewBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-full transition-colors",
        active ? "bg-[var(--accent-primary)] text-[#0e0f0c]" : "text-tertiary",
      )}
    >
      {children}
    </button>
  );
}
