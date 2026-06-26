"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { HorseWithPnl } from "@/lib/hooks/use-horses";
import { HorseAvatar } from "@/components/horse/horse-avatar";
import { KeyNumber } from "@/components/ui/key-number";
import { Sparkline } from "@/components/ui/sparkline";

const TREND_ICON = {
  hausse: <TrendingUp size={13} />,
  baisse: <TrendingDown size={13} />,
  stable: <Minus size={13} />,
};

export function HorseCard({ item, index }: { item: HorseWithPnl; index: number }) {
  const { horse, pnl, trend, series } = item;
  const underThreshold = pnl.netResult < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={`/cheval?id=${horse.id}`}
        className="block rounded-[var(--radius-lg)] border bg-elevated p-4 transition-colors active:bg-[var(--bg-pressed)]"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <HorseAvatar name={horse.name} size={40} />
            <div>
              <p className="font-[family-name:var(--font-fraunces)] text-lg leading-tight text-primary">
                {horse.name}
              </p>
              <p className="text-2xs text-tertiary">
                {horse.breed}
                {horse.birthYear ? ` · ${new Date().getFullYear() - horse.birthYear} ans` : ""}
              </p>
            </div>
          </div>
          <span
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs"
            style={{
              color:
                trend === "hausse"
                  ? "var(--c-success)"
                  : trend === "baisse"
                    ? "var(--c-danger)"
                    : "var(--text-tertiary)",
              background: "var(--bg-pressed)",
            }}
          >
            {TREND_ICON[trend]}
            {trend}
          </span>
        </div>

        <div className="mt-3 flex items-end justify-between">
          <div>
            <KeyNumber
              value={pnl.netResult}
              colorBySign
              className="text-2xl"
              animateOnMount={false}
            />
            {underThreshold && (
              <span className="ml-2 rounded-full bg-[var(--c-danger-soft)] px-2 py-0.5 text-[10px] text-[var(--c-danger)]">
                sous le seuil
              </span>
            )}
          </div>
          <Sparkline data={series} area width={96} height={36} />
        </div>
      </Link>
    </motion.div>
  );
}
