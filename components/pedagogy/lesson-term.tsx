"use client";

import { useState } from "react";
import { LESSONS } from "@/content/lessons";
import { LessonSheet } from "@/components/ed/explain";
import { cn } from "@/lib/utils/cn";

interface LessonTermProps {
  lessonKey: keyof typeof LESSONS | string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Any metier term in the UI is tappable (section 1.2). Tapping opens the same
 * lesson sheet as `Explain`, computed against the user's live data.
 */
export function LessonTerm({ lessonKey, children, className }: LessonTermProps) {
  const [open, setOpen] = useState(false);
  if (!LESSONS[lessonKey]) return <>{children}</>;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn("cn-term underline decoration-dotted decoration-[var(--ink)] underline-offset-4", className)}
      >
        {children}
      </button>
      {open && <LessonSheet k={String(lessonKey)} onClose={() => setOpen(false)} />}
    </>
  );
}
