"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Pill } from "../_ui";

const HORSES = ["Sirius", "Diva", "Belle", "Tonnerre", "Princesse", "Vaillant", "Pacha", "Mistral"];
const REVENUE_CATS = ["Pension", "Cours", "Sport", "Demi-pension"];
const EXPENSE_CATS = ["Maréchal", "Véto", "Compléments", "Foin"];

/* Saisie éclair — pensée pour 10 secondes, à une main. */
export default function ProtoSaisie() {
  const [kind, setKind] = useState<"revenu" | "charge">("revenu");
  const [horse, setHorse] = useState<string | null>("Belle");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState(REVENUE_CATS[0]);

  const cats = kind === "revenu" ? REVENUE_CATS : EXPENSE_CATS;
  const accent = kind === "revenu" ? "var(--p-mint)" : "var(--p-peach)";

  return (
    <main
      className="mx-auto min-h-dvh max-w-[440px] px-5 pb-10 pt-5"
      style={{ background: "var(--p-page)" }}
    >
      <div className="flex items-center justify-between">
        <h1 className="proto-disp text-[26px]">{"Saisie éclair"}</h1>
        <Link
          href="/proto/aujourdhui"
          className="flex size-9 items-center justify-center rounded-full border-[2.5px] border-[var(--p-ink)] bg-white"
        >
          <X size={18} />
        </Link>
      </div>

      {/* Revenu / Charge */}
      <div className="mt-5 flex gap-2 rounded-full border-[2.5px] border-[var(--p-ink)] bg-white p-1">
        {(["revenu", "charge"] as const).map((k) => (
          <button
            key={k}
            onClick={() => {
              setKind(k);
              setCat((k === "revenu" ? REVENUE_CATS : EXPENSE_CATS)[0]);
            }}
            className="flex-1 rounded-full py-2.5 text-[15px] font-extrabold capitalize"
            style={{
              background: kind === k ? "var(--p-ink)" : "transparent",
              color: kind === k ? "white" : "var(--p-ink)",
            }}
          >
            {k === "revenu" ? "Un revenu" : "Une charge"}
          </button>
        ))}
      </div>

      {/* Montant */}
      <div
        className="mt-4 flex items-center gap-2 rounded-[22px] border-[2.5px] border-[var(--p-ink)] px-5 py-5"
        style={{ background: accent, boxShadow: "0 4px 0 var(--p-ink)" }}
      >
        <input
          type="number"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="proto-disp w-full bg-transparent text-[44px] outline-none placeholder:text-[var(--p-ink)]/30"
        />
        <span className="proto-disp text-[36px]">{"€"}</span>
      </div>

      {/* Cheval */}
      <p className="mt-5 text-[13px] font-extrabold uppercase text-[var(--p-muted)]">
        {"Pour quel cheval ?"}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {HORSES.map((h) => (
          <button
            key={h}
            onClick={() => setHorse(h)}
            className="rounded-full border-[2.5px] border-[var(--p-ink)] px-3.5 py-1.5 text-[14px] font-extrabold"
            style={{ background: horse === h ? "var(--p-purple)" : "white", color: horse === h ? "white" : "var(--p-ink)" }}
          >
            {h}
          </button>
        ))}
      </div>

      {/* Catégorie */}
      <p className="mt-5 text-[13px] font-extrabold uppercase text-[var(--p-muted)]">{"Type"}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className="rounded-full border-[2.5px] border-[var(--p-ink)] px-3.5 py-1.5 text-[14px] font-extrabold"
            style={{ background: cat === c ? "var(--p-lime)" : "white" }}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-2 text-[13px] font-semibold text-[var(--p-muted)]">
        <Pill bg="white">{"10 sec ⏱"}</Pill>
        {horse ? `${cat} pour ${horse}` : "Choisis un cheval"}
      </div>

      <Link
        href="/proto/aujourdhui"
        className="mt-4 flex items-center justify-center gap-3 rounded-full border-[2.5px] border-[var(--p-ink)] bg-[var(--p-ink)] py-3.5 text-white"
        style={{ boxShadow: "0 4px 0 rgba(0,0,0,0.35)", opacity: amount && horse ? 1 : 0.5 }}
      >
        <Check size={20} />
        <span className="proto-disp text-[18px]">{"Enregistrer"}</span>
      </Link>
    </main>
  );
}
