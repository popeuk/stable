"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, HelpCircle } from "lucide-react";
import { LESSONS } from "@/content/lessons";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { cn } from "@/lib/utils/cn";

/**
 * The didactic heart of the app (spec 1.2 — pédagogie en filigrane). Wrap any
 * métier term or number; tapping opens a short lesson computed on the user's
 * own data. Learning is never a separate section — it lives on every figure.
 */
export function Explain({
  k,
  children,
  variant = "term",
  className,
}: {
  k: keyof typeof LESSONS | string;
  children: React.ReactNode;
  /** "term": dotted-underline inline word. "chip": a small ? button after content. */
  variant?: "term" | "chip" | "plain";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const lesson = LESSONS[k];
  const data = useDataStore();
  const period = usePeriodStore((s) => s.active);
  if (!lesson) return <>{children}</>;

  const trigger =
    variant === "chip" ? (
      <span className={cn("inline-flex items-center gap-1", className)}>
        {children}
        <button
          onClick={() => setOpen(true)}
          aria-label={`Comprendre : ${lesson.title}`}
          className="inline-flex size-[18px] items-center justify-center border border-[var(--border-strong)] text-tertiary"
        >
          <HelpCircle size={11} />
        </button>
      </span>
    ) : variant === "plain" ? (
      <button onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
    ) : (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "underline decoration-dotted decoration-[var(--accent-primary)] underline-offset-[3px] transition-colors hover:text-[var(--accent-primary)]",
          className,
        )}
      >
        {children}
      </button>
    );

  return (
    <>
      {trigger}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              aria-label="Fermer"
              className="absolute inset-0"
              style={{ background: "var(--bg-overlay)" }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-label={lesson.title}
              className="relative z-10 w-full max-w-[440px] border-t-2 border-[var(--text-primary)] bg-elevated px-6 pb-10 pt-5"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
            >
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--accent-primary)]">
                  Notion · 2 min
                </span>
                <button onClick={() => setOpen(false)} aria-label="Fermer" className="text-tertiary">
                  <X size={20} />
                </button>
              </div>

              <h3 className="mt-2 font-[family-name:var(--font-fraunces)] text-2xl text-primary">
                {lesson.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-secondary">
                {lesson.definition}
              </p>

              {lesson.yourData && (
                <div className="mt-4 border border-[var(--border-strong)] bg-base p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--accent-primary)]">
                    Pour toi, ce mois
                  </p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-primary">
                    {lesson.yourData(data, period)}
                  </p>
                </div>
              )}

              <p className="mt-5 text-[11px] font-bold uppercase tracking-wide text-tertiary">
                Ce que tu peux faire
              </p>
              <div className="mt-2 border-t border-[var(--border-default)]">
                {lesson.whatToDo.map((t, i) => (
                  <div key={i} className="flex gap-3 border-b border-[var(--border-default)] py-3">
                    <span className="text-[13px] font-bold tabular-nums text-tertiary">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-[14px] leading-relaxed text-secondary">{t}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setOpen(false)}
                className="mt-6 w-full bg-[var(--text-primary)] py-3 text-[15px] font-bold text-[var(--bg-base)]"
              >
                J&apos;ai compris
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
