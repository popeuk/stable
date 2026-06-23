"use client";

import { useState } from "react";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { TopBar, Tag, ArrowDisc } from "../_ui";

const FIXED = 2500;
const VARIABLE = 180;

function eur(n: number) {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(n))} €`;
}

export default function ProtoOnboarding() {
  const [horses, setHorses] = useState(12);
  const [pension, setPension] = useState(450);

  const revenue = horses * pension;
  const result = revenue - FIXED - horses * VARIABLE;
  const positive = result >= 0;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col">
      <TopBar />

      <div className="px-5 pt-5">
        <Tag>À la louche</Tag>
        <h1 className="mt-3 text-[28px] font-extrabold leading-tight">
          {"Ton écurie en deux réponses"}
        </h1>
      </div>

      {/* Q1 */}
      <div className="mx-5 mt-5 border border-[var(--o-line-strong)] bg-[var(--o-paper)]">
        <div className="flex items-center justify-between p-5">
          <p className="text-[15px] font-semibold">{"Chevaux en pension"}</p>
          <div className="flex items-center gap-4">
            <button
              aria-label="moins"
              onClick={() => setHorses(Math.max(1, horses - 1))}
              className="flex size-9 items-center justify-center border border-[var(--o-line-strong)]"
            >
              <Minus size={16} />
            </button>
            <span className="w-9 text-center text-[28px] font-extrabold tabular-nums">{horses}</span>
            <button
              aria-label="plus"
              onClick={() => setHorses(Math.min(40, horses + 1))}
              className="flex size-9 items-center justify-center border border-[var(--o-line-strong)] bg-[var(--o-yellow)]"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Q2 */}
      <div className="mx-5 mt-3 border border-[var(--o-line-strong)] bg-[var(--o-paper)] p-5">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold">{"Pension moyenne / mois"}</p>
          <span className="text-[22px] font-extrabold tabular-nums">{eur(pension)}</span>
        </div>
        <input
          type="range"
          min={100}
          max={1200}
          step={10}
          value={pension}
          onChange={(e) => setPension(Number(e.target.value))}
          className="mt-4 w-full"
          style={{ accentColor: "var(--o-ink)", height: 26 }}
        />
      </div>

      {/* Déclic */}
      <div className="mx-5 mt-5 border border-[var(--o-ink)]">
        <div className="flex items-center justify-between border-b border-[var(--o-line)] bg-[var(--o-ink)] px-5 py-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--o-bg)]">
            {"Ton résultat estimé / mois"}
          </span>
          <Tag tone={positive ? "green" : "red"}>{positive ? "Dans le vert" : "Dans le rouge"}</Tag>
        </div>
        <div className="bg-[var(--o-paper)] px-5 py-6">
          <p
            className="text-[52px] font-extrabold leading-none tabular-nums"
            style={{ color: positive ? "var(--o-green)" : "var(--o-red)" }}
          >
            {result >= 0 ? eur(result) : `−${eur(Math.abs(result))}`}
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--o-muted)]">
            {positive
              ? "Bonne nouvelle. On va voir quels chevaux tirent l’écurie vers le haut."
              : "Tu perds de l’argent chaque mois. On va trouver exactement où, ensemble."}
          </p>
        </div>
      </div>

      <div className="mt-auto px-5 pb-7 pt-6">
        <Link
          href="/proto/aujourdhui"
          className="flex items-center justify-between border border-[var(--o-ink)] bg-[var(--o-ink)] py-2 pl-5 pr-2 text-[var(--o-bg)]"
        >
          <span className="text-[17px] font-bold">{"Voir mon tableau de bord"}</span>
          <ArrowDisc size={44} />
        </Link>
      </div>
    </main>
  );
}
