"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { LESSONS } from "@/content/lessons";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { useCoachStore } from "@/stores/coach-store";
import { useFeuille } from "@/components/bs/feuille";
import { Ic } from "@/components/carnet/ui";
import { cn } from "@/lib/utils/cn";

/**
 * The didactic heart of the app (spec 1.2 : pédagogie en filigrane). Wrap any
 * métier term or number; tapping opens a short lesson computed on the user's
 * own data. Learning is never a separate section: it lives on every figure.
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
  const markSeen = useCoachStore((s) => s.markLessonSeen);
  const reveal = () => {
    markSeen(String(k));
    setOpen(true);
  };
  if (!lesson) return <>{children}</>;

  const trigger =
    variant === "chip" ? (
      <span className={cn("inline-flex items-center gap-1", className)}>
        {children}
        <button type="button" onClick={reveal} aria-label={`Comprendre : ${lesson.title}`} aria-haspopup="dialog" className="cn-term-chip">
          <Ic n="help" className="" />
        </button>
      </span>
    ) : variant === "plain" ? (
      <button type="button" onClick={reveal} aria-haspopup="dialog" className={className}>
        {children}
      </button>
    ) : (
      <button
        type="button"
        onClick={reveal}
        aria-haspopup="dialog"
        className={cn("cn-term underline decoration-dotted decoration-[var(--ink)] underline-offset-[3px]", className)}
      >
        {children}
      </button>
    );

  return (
    <>
      {trigger}
      {open && <LessonSheet k={String(k)} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * La feuille d'une notion : la feuille du carnet, posée sur `body` (rien ne la
 * rogne ni ne la décale, même sous un bloc animé), qui tient le focus.
 */
export function LessonSheet({ k, onClose }: { k: string; onClose: () => void }) {
  const lesson = LESSONS[k];
  const data = useDataStore();
  const period = usePeriodStore((s) => s.active);
  const ref = useFeuille(onClose, { verrou: true });
  const id = useId();
  if (!lesson || typeof document === "undefined") return null;
  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet cn-lesson" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} ref={ref}>
          <div className="grab" />
          <div className="shd">
            <b id={`${id}-t`}>{lesson.title}</b>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          <div className="pad">
            <p className="cn-lesson-def">{lesson.definition}</p>
            {lesson.yourData && (
              <div className="tip cn-lesson-toi">
                <span>
                  <b>Pour toi, ce mois</b>
                  <br />
                  {lesson.yourData(data, period)}
                </span>
              </div>
            )}
            {lesson.whatToDo.length > 0 && (
              <>
                <h3 className="cn-lesson-h">Ce que tu peux faire</h3>
                <ol className="nt-steps">
                  {lesson.whatToDo.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ol>
              </>
            )}
            <button type="button" className="btn full" style={{ marginTop: 20 }} onClick={onClose}>
              J’ai compris
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
