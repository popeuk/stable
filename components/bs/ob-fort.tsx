"use client";

import { useEffect, useMemo, useState } from "react";
import { CountUp, Ic, eurc } from "@/components/carnet/ui";
import { estAMoi, fraisDuMois } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";

/**
 * Propositions « onboarding fort » (18 octobre 2026), à comparer derrière
 * ?v=a, ?v=b ou ?v=c (?v=0 revient à l'actuel). Le choix est gardé pour
 * l'onglet, pour suivre tout le parcours.
 *   a · Le chiffre qui monte : le mois se construit en direct, en vert.
 *   b · Trois chapitres : chaque scène a sa lumière et son sol.
 *   c · Le livret : on remplit le livret de l'écurie, le flot tombe à la fin.
 * Styles : app/carnet/ob-fort.css.
 */
export type ObV = "a" | "b" | "c" | null;
const CLE = "be-stable-ob-v";

export function useObV(): ObV {
  const [v, setV] = useState<ObV>(null);
  useEffect(() => {
    let x: string | null = new URLSearchParams(window.location.search).get("v");
    try {
      if (x === "0") {
        sessionStorage.removeItem(CLE);
        x = null;
      } else if (x && /^[abc]$/.test(x)) sessionStorage.setItem(CLE, x);
      else x = sessionStorage.getItem(CLE);
    } catch {}
    const ok = x && /^[abc]$/.test(x) ? (x as ObV) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setV(ok);
    if (ok) document.documentElement.dataset.ob = ok;
    else delete document.documentElement.dataset.ob;
  }, []);
  return v;
}

/** Ce qu'une question a déjà en main sans l'avoir enregistré (le nombre et la pension tapés). */
export interface Apercu {
  chevaux?: number;
  pension?: number;
}

/** Le mois tel qu'il se dessine, avec ce que la question en cours a déjà tapé. */
export function useMoisVivant(apercu?: Apercu) {
  const data = useDataStore();
  const ac = apercu?.chevaux;
  const ap = apercu?.pension;
  return useMemo(() => {
    const m = monthBreakdown(data, currentPeriod());
    const enPension = data.horses.filter((h) => !h.isArchived && !estAMoi(h)).length;
    const f = fraisDuMois(data);
    const frais = f.total + f.postes;
    const pension = ap ?? data.tariffs?.pension ?? 0;
    const chevaux = ac ?? enPension;
    // Avant le premier enregistrement, le mois vient de ce qui est tapé.
    const net = enPension === 0 && ac ? ac * (ap ?? 0) - m.sharedTotal : Math.round(m.net);
    return { net, chevaux, pension, frais };
  }, [data, ac, ap]);
}

/** A · La bande vert anglais en tête de chaque question : le mois, en direct. */
export function BandeMois({ apercu, n }: { apercu?: Apercu; n: number }) {
  const { net, chevaux, pension } = useMoisVivant(apercu);
  const vide = !chevaux || !pension;
  return (
    <div className="obf-bande" aria-live="polite">
      <span className="obf-bande-k">{vide ? "Ton mois se construit ici" : n === 3 ? "Ce qu’il te reste par mois" : "Ce que tes pensions rapportent"}</span>
      <span className="obf-bande-v">{vide ? "…" : <CountUp value={net} ms={700} />}</span>
      {!vide && (
        <span className="obf-bande-s num">
          {chevaux} × {eurc(pension)}
        </span>
      )}
    </div>
  );
}

/** C · Le livret de l'écurie : trois champs numérotés, remplis à mesure. */
export function LivretTete({ apercu, n }: { apercu?: Apercu; n: number }) {
  const { chevaux, pension, frais } = useMoisVivant(apercu);
  const nom = useSettingsStore((s) => s.stableName);
  const champs: { k: string; v: string | null }[] = [
    { k: "Chevaux en pension", v: chevaux ? `${chevaux}` : null },
    { k: "La pension", v: pension ? `${eurc(pension)} / mois` : null },
    { k: "Les frais de l’écurie", v: frais ? `${eurc(frais)} / mois` : null },
  ];
  return (
    <div className="obf-livret" aria-label="Le livret de ton écurie">
      <div className="obf-livret-h">
        <b>{nom && nom !== "Mon écurie" ? nom : "Ton écurie"}</b>
        <span>livret de l’écurie</span>
      </div>
      <ol>
        {champs.map((c, i) => {
          const st = i + 1 < n ? "fait" : i + 1 === n ? "now" : "next";
          return (
            <li key={c.k} className={st}>
              <span className="obf-num" aria-hidden="true">
                {st === "fait" ? <Ic n="ck" className="" /> : i + 1}
              </span>
              <span className="obf-k">{c.k}</span>
              <span className="obf-v num">{c.v ?? (st === "now" ? "à remplir" : "")}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Le flot de concours (DESIGN.md) : disque vert à 18 festons, centre rose,
 * anneau pointillé, une ou deux lignes de lettres, deux flammes.
 */
export function Flot({ l1, l2, className = "" }: { l1: string; l2?: string; className?: string }) {
  const festons = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    return <circle key={i} cx={60 + 41 * Math.cos(a)} cy={56 + 41 * Math.sin(a)} r={9.5} />;
  });
  return (
    <svg className={`obf-flot ${className}`} viewBox="0 0 120 150" role="img" aria-label={[l1, l2].filter(Boolean).join(" ")}>
      <g className="obf-flot-q">
        <path d="M38 88 L24 146 L39 136 L50 148 L58 92 Z" />
        <path d="M82 88 L96 146 L81 136 L70 148 L62 92 Z" opacity=".82" />
      </g>
      <g className="obf-flot-d">
        {festons}
        <circle cx="60" cy="56" r="42" />
      </g>
      <circle className="obf-flot-c" cx="60" cy="56" r="35" />
      <circle className="obf-flot-p" cx="60" cy="56" r="30" fill="none" strokeWidth=".8" strokeDasharray="1.6 2.4" />
      <text x="60" y={l2 ? 53 : 60} textAnchor="middle">
        {l1}
      </text>
      {l2 && (
        <text x="60" y="67" textAnchor="middle">
          {l2}
        </text>
      )}
    </svg>
  );
}

