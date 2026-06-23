"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar } from "../_ui";
import { BottomNav } from "../_nav";

const HORSES = ["Sirius", "Diva", "Belle", "Tonnerre", "Princesse", "Vaillant", "Pacha", "Mistral"];
const REVENUE_CATS = ["Pension", "Cours", "Sport", "Demi-pension"];
const EXPENSE_CATS = ["Maréchal", "Véto", "Compléments", "Foin"];

export default function ProtoSaisie() {
  const [kind, setKind] = useState<"revenu" | "charge">("revenu");
  const [horse, setHorse] = useState<string | null>("Belle");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState(REVENUE_CATS[0]);

  const cats = kind === "revenu" ? REVENUE_CATS : EXPENSE_CATS;

  return (
    <main className="mx-auto min-h-dvh max-w-[440px] pb-24">
      <TopBar />

      <div className="px-5 pt-5">
        <h1 className="text-[28px] font-extrabold">{"Saisie éclair"}</h1>
        <p className="mt-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--o-muted)]">
          {"10 secondes, à une main"}
        </p>
      </div>

      {/* Revenu / Charge */}
      <div className="mx-5 mt-5 grid grid-cols-2 border border-[var(--o-line-strong)]">
        {(["revenu", "charge"] as const).map((k) => (
          <button
            key={k}
            onClick={() => {
              setKind(k);
              setCat((k === "revenu" ? REVENUE_CATS : EXPENSE_CATS)[0]);
            }}
            className="py-3 text-[14px] font-bold capitalize"
            style={{
              background: kind === k ? "var(--o-ink)" : "transparent",
              color: kind === k ? "var(--o-bg)" : "var(--o-ink)",
            }}
          >
            {k === "revenu" ? "Un revenu" : "Une charge"}
          </button>
        ))}
      </div>

      {/* Montant */}
      <div className="mx-5 mt-3 flex items-end gap-2 border-b-2 border-[var(--o-ink)] px-1 pb-2 pt-4">
        <input
          type="number"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-transparent text-[44px] font-extrabold tabular-nums outline-none placeholder:text-[var(--o-line-strong)]"
        />
        <span className="pb-2 text-[28px] font-extrabold text-[var(--o-muted)]">{"€"}</span>
      </div>

      {/* Cheval */}
      <div className="px-5 pt-5">
        <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--o-muted)]">
          {"Pour quel cheval"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {HORSES.map((h) => (
            <button
              key={h}
              onClick={() => setHorse(h)}
              className="border px-3 py-1.5 text-[13px] font-bold"
              style={{
                borderColor: horse === h ? "var(--o-ink)" : "var(--o-line-strong)",
                background: horse === h ? "var(--o-ink)" : "transparent",
                color: horse === h ? "var(--o-bg)" : "var(--o-ink)",
              }}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      {/* Type */}
      <div className="px-5 pt-5">
        <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--o-muted)]">{"Type"}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className="border px-3 py-1.5 text-[13px] font-bold"
              style={{
                borderColor: cat === c ? "var(--o-ink)" : "var(--o-line-strong)",
                background: cat === c ? "var(--o-yellow)" : "transparent",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-7">
        <Link
          href="/proto/aujourdhui"
          className="flex items-center justify-center border border-[var(--o-ink)] bg-[var(--o-ink)] py-3.5 text-[16px] font-bold text-[var(--o-bg)]"
          style={{ opacity: amount && horse ? 1 : 0.45 }}
        >
          {"Enregistrer"}
        </Link>
      </div>

      <BottomNav />
    </main>
  );
}
