"use client";

import { useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { X } from "lucide-react";
import { LESSONS } from "@/content/lessons";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { cn } from "@/lib/utils/cn";

interface LessonTermProps {
  lessonKey: keyof typeof LESSONS | string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Any metier term in the UI is tappable (section 1.2). Tapping opens a
 * full-context bottom sheet computed against the user's live data.
 */
export function LessonTerm({ lessonKey, children, className }: LessonTermProps) {
  const [open, setOpen] = useState(false);
  const lesson = LESSONS[lessonKey];
  const data = useDataStore();
  const period = usePeriodStore((s) => s.active);

  if (!lesson) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "cn-term underline decoration-dotted decoration-[var(--ink)] underline-offset-4 transition-colors hover:text-[var(--ink)]",
          className,
        )}
      >
        {children}
      </button>

      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed inset-0 z-50 flex items-end justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button
                aria-label="Fermer"
                className="absolute inset-0"
                style={{ background: "var(--scrim)" }}
                onClick={() => setOpen(false)}
              />
              <motion.div
                role="dialog"
                aria-label={lesson.title}
                className="relative z-10 w-full max-w-[480px] rounded-t-[var(--radius-xl)] border-t bg-elevated px-6 pb-10 pt-5"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              >
                <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[var(--line)]" />
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Fermer"
                  className="absolute right-5 top-5 text-tertiary"
                >
                  <X size={20} />
                </button>

                <h2 className="font-[family-name:var(--font-bricolage)] text-xl text-primary">
                  {lesson.title}
                </h2>
                <p className="mt-2 text-sm text-secondary">{lesson.definition}</p>

                {lesson.yourData && (
                  <div className="mt-5 rounded-[var(--radius-lg)] bg-[var(--mist)] p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink)]">
                      Pour toi, ça veut dire
                    </p>
                    <p className="mt-1.5 text-sm text-primary">
                      {lesson.yourData(data, period)}
                    </p>
                  </div>
                )}

                <p className="mt-5 text-xs font-medium uppercase tracking-wide text-tertiary">
                  Ce que tu peux faire
                </p>
                <ul className="mt-2 space-y-2">
                  {lesson.whatToDo.map((t, i) => (
                    <li key={i} className="flex gap-2 text-sm text-secondary">
                      <span className="text-[var(--ink)]">·</span>
                      {t}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => setOpen(false)}
                  className="mt-6 w-full rounded-[var(--radius-md)] bg-[var(--ink)] py-3 text-sm font-medium text-[var(--on-ink)]"
                >
                  Compris
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </MotionConfig>
    </>
  );
}
