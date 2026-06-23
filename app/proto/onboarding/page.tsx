"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { Coin, Wordmark, Pill } from "../_ui";

const FIXED = 2500; // charges fixes mensuelles, à la louche
const VARIABLE = 180; // coût variable par cheval, à la louche

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
    <main
      className="mx-auto flex min-h-dvh max-w-[440px] flex-col px-6 pb-8 pt-6"
      style={{ background: "var(--p-page)" }}
    >
      <Wordmark />

      <p className="mt-8 proto-disp text-[15px] text-[var(--p-muted)]">
        {"À la louche — on affine après"}
      </p>
      <h1 className="proto-disp mt-1 text-[30px]">{"Ton écurie en 2 réponses"}</h1>

      {/* Question 1 : nombre de chevaux */}
      <div
        className="mt-6 rounded-[22px] border-[2.5px] border-[var(--p-ink)] bg-white p-5"
        style={{ boxShadow: "0 4px 0 var(--p-ink)" }}
      >
        <p className="text-[15px] font-bold">{"Combien de chevaux en pension ?"}</p>
        <div className="mt-3 flex items-center justify-between">
          <Stepper value={horses} min={1} max={40} onChange={setHorses} />
          <span className="proto-disp text-[40px]">{horses}</span>
        </div>
      </div>

      {/* Question 2 : pension moyenne */}
      <div
        className="mt-4 rounded-[22px] border-[2.5px] border-[var(--p-ink)] bg-white p-5"
        style={{ boxShadow: "0 4px 0 var(--p-ink)" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-bold">{"Pension moyenne / mois"}</p>
          <span className="proto-disp text-[24px]">{eur(pension)}</span>
        </div>
        <input
          type="range"
          min={100}
          max={1200}
          step={10}
          value={pension}
          onChange={(e) => setPension(Number(e.target.value))}
          className="mt-4 w-full"
          style={{ accentColor: "var(--p-purple)", height: 28 }}
        />
      </div>

      {/* Le déclic */}
      <div
        className="mt-5 flex-1 rounded-[26px] border-[2.5px] border-[var(--p-ink)] p-6"
        style={{
          background: positive ? "var(--p-mint)" : "var(--p-pink)",
          boxShadow: "0 5px 0 var(--p-ink)",
        }}
      >
        <div className="flex items-center justify-between">
          <Pill bg="white">{positive ? "Dans le vert" : "Dans le rouge"}</Pill>
          <Coin size={34} />
        </div>
        <p className="mt-4 text-[14px] font-bold uppercase tracking-wide text-[var(--p-ink)]/60">
          {"Ton résultat estimé / mois"}
        </p>
        <p className="proto-disp text-[56px]">
          {result >= 0 ? eur(result) : `−${eur(Math.abs(result))}`}
        </p>
        <p className="mt-2 text-[15px] font-semibold">
          {positive
            ? "Bonne nouvelle. On va voir quels chevaux tirent l’écurie vers le haut."
            : "Tu perds de l’argent chaque mois. On va trouver exactement où, ensemble."}
        </p>
      </div>

      <Link
        href="/proto/aujourdhui"
        className="mt-5 flex items-center justify-between rounded-full border-[2.5px] border-[var(--p-ink)] bg-[var(--p-ink)] px-3 py-3 pl-4 text-white"
        style={{ boxShadow: "0 4px 0 rgba(0,0,0,0.35)" }}
      >
        <span className="flex items-center gap-3">
          <Coin size={38} />
          <span className="proto-disp text-[18px]">{"Voir mon tableau de bord"}</span>
        </span>
        <ArrowRight className="mr-2" />
      </Link>
    </main>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const btn =
    "flex size-11 items-center justify-center rounded-full border-[2.5px] border-[var(--p-ink)] bg-[var(--p-lime)]";
  return (
    <div className="flex items-center gap-3">
      <button
        aria-label="moins"
        className={btn}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus size={20} />
      </button>
      <button
        aria-label="plus"
        className={btn}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus size={20} />
      </button>
    </div>
  );
}
