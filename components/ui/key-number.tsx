"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { formatEur, formatPct } from "@/lib/utils/format-currency";
import { cn } from "@/lib/utils/cn";

type Format = "eur" | "pct" | "raw";

interface KeyNumberProps {
  value: number;
  format?: Format;
  /** Colour by sign: positive = success, negative = danger. */
  colorBySign?: boolean;
  /** Tailwind text size class, e.g. "text-5xl". */
  className?: string;
  prefix?: string;
  suffix?: string;
  animateOnMount?: boolean;
}

function render(value: number, format: Format): string {
  if (format === "eur") return formatEur(value);
  if (format === "pct") return formatPct(value);
  return new Intl.NumberFormat("fr-FR").format(Math.round(value));
}

/**
 * A hero figure (section 7.7 / 7.6). Rendered in Fraunces with tabular
 * numerals, animated with a counter on mount, coloured by sign.
 */
export function KeyNumber({
  value,
  format = "eur",
  colorBySign = false,
  className,
  prefix,
  suffix,
  animateOnMount = true,
}: KeyNumberProps) {
  const [display, setDisplay] = useState(animateOnMount ? 0 : value);
  const prev = useRef(animateOnMount ? 0 : value);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // Intentional: snap to the value when motion is reduced.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);

  const color = colorBySign
    ? value > 0
      ? "text-[var(--c-success)]"
      : value < 0
        ? "text-[var(--c-danger)]"
        : "text-primary"
    : undefined;

  return (
    <span
      className={cn(
        "font-[family-name:var(--font-fraunces)] tabnums font-semibold tracking-tight",
        color,
        className,
      )}
      style={{ color: color ? undefined : "var(--text-primary)" }}
    >
      {prefix}
      {render(display, format)}
      {suffix}
    </span>
  );
}
