"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { useFlashStore } from "@/stores/flash-store";
import { formatEur } from "@/lib/utils/format-currency";

/**
 * The post-save moment: your entry, its amount, and the nudge that the
 * numbers below just moved because of it. Auto-dismisses; tap to dismiss.
 */
export function ImpactFlash() {
  const flash = useFlashStore((s) => s.flash);
  const clear = useFlashStore((s) => s.clearFlash);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(clear, 4000);
    return () => clearTimeout(t);
  }, [flash, clear]);

  return (
    <AnimatePresence>
      {flash && (
        <motion.button
          onClick={clear}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mb-4 flex w-full items-center gap-3 ink-panel p-3.5 text-left text-[var(--on-ink)]"
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center"
            style={{
              background:
                flash.kind === "revenue" ? "var(--c-success)" : "var(--accent-primary)",
              color: "#fff",
            }}
          >
            <Check size={16} strokeWidth={3} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold leading-tight">
              {flash.kind === "revenue" ? "+" : "−"}
              {formatEur(flash.amount)} enregistrés · {flash.label}
            </span>
            <span className="block text-[12px] text-[var(--on-ink)]/70">
              Tes chiffres viennent de bouger : regarde en dessous.
            </span>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
