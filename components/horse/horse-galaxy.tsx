"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import type { HorseWithPnl } from "@/lib/hooks/use-horses";

/**
 * Galaxy view (section 9.3). Each horse is an orb:
 *   size   = revenue generated
 *   colour = net margin (success ↔ danger)
 *   x      = tenure in the stable (left = recent, right = old)
 *   y      = volatility (top = stable, bottom = unpredictable)
 */
export function HorseGalaxy({ items }: { items: HorseWithPnl[] }) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  if (items.length === 0) return null;

  const W = 360;
  const H = 440;
  const pad = 44;

  const tenure = items.map(
    (it) => now - Date.parse(it.horse.entryDate + "T00:00:00Z"),
  );
  const maxTenure = Math.max(...tenure, 1);
  const maxRevenue = Math.max(...items.map((i) => i.pnl.revenue), 1);
  const maxVol = Math.max(...items.map((i) => i.volatility), 1);

  function marginColor(pct: number): string {
    // -30%..+30% → danger..success
    const t = Math.max(0, Math.min(1, (pct + 30) / 60));
    const danger = [194, 75, 61];
    const success = [122, 159, 94];
    const c = danger.map((d, i) => Math.round(d + (success[i] - d) * t));
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }

  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* Axis hints */}
        <text x={pad} y={16} fill="var(--text-tertiary)" fontSize="9">
          récents
        </text>
        <text x={W - pad} y={16} fill="var(--text-tertiary)" fontSize="9" textAnchor="end">
          anciens
        </text>
        <text
          x={10}
          y={H / 2}
          fill="var(--text-tertiary)"
          fontSize="9"
          transform={`rotate(-90 10 ${H / 2})`}
          textAnchor="middle"
        >
          ← imprévisible · stable →
        </text>

        {items.map((it, i) => {
          const x =
            pad + (1 - tenure[i] / maxTenure) * (W - pad * 2);
          const y =
            pad + (it.volatility / maxVol) * (H - pad * 2);
          const r = 10 + (it.pnl.revenue / maxRevenue) * 26;
          const color = marginColor(it.pnl.netMarginPct);
          return (
            <motion.g
              key={it.horse.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 20,
                delay: i * 0.05,
              }}
              style={{ cursor: "pointer", transformOrigin: `${x}px ${y}px` }}
              onClick={() => router.push(`/cheval?id=${it.horse.id}`)}
            >
              <circle cx={x} cy={y} r={r + 6} fill={color} opacity={0.12} />
              <circle cx={x} cy={y} r={r} fill={color} opacity={0.85} />
              <text
                x={x}
                y={y + r + 12}
                fill="var(--text-secondary)"
                fontSize="9"
                textAnchor="middle"
                className="font-[family-name:var(--font-fraunces)]"
              >
                {it.horse.name}
              </text>
            </motion.g>
          );
        })}
      </svg>
      <p className="mt-2 text-center text-2xs text-tertiary">
        Taille = chiffre d&apos;affaires · couleur = marge nette
      </p>
    </div>
  );
}
