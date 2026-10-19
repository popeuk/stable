"use client";

import { useId, useState } from "react";
import { jourPossible, joursProposes } from "@/lib/domain/jour-paiement";

/**
 * Quel jour il a payé : Aujourd'hui, Hier, Avant-hier, ou un autre jour
 * (lib/domain/jour-paiement). Mêmes puces que « Comment ? » (app/carnet/facture.css, mp-).
 */
export function JourChoix({ value, onChange, today }: { value: string; onChange: (date: string) => void; today: string }) {
  const q = useId();
  const proposes = joursProposes(today);
  const [autre, setAutre] = useState(() => !proposes.some((p) => p.date === value));
  return (
    <div className="mp">
      <p className="mp-q" id={q}>
        Quel jour ?
      </p>
      <div className="mp-chips" role="radiogroup" aria-labelledby={q}>
        {proposes.map((p) => (
          <button
            key={p.date}
            type="button"
            role="radio"
            aria-checked={!autre && value === p.date}
            className={`chip${!autre && value === p.date ? " on" : ""}`}
            onClick={() => {
              setAutre(false);
              onChange(p.date);
            }}
          >
            {p.label}
          </button>
        ))}
        <button type="button" role="radio" aria-checked={autre} className={`chip${autre ? " on" : ""}`} onClick={() => setAutre(true)}>
          Autre jour
        </button>
      </div>
      {autre && (
        <label className="mp-chq">
          <span>Le jour du paiement</span>
          <input className="input" type="date" max={today} value={value} onChange={(e) => jourPossible(e.target.value, today) && onChange(e.target.value)} />
        </label>
      )}
    </div>
  );
}
