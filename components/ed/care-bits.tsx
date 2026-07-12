"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Syringe,
  Pill,
  Stethoscope,
  Bone,
  Smile,
  HeartPulse,
  Activity,
  Trophy,
  FileText,
  Check,
  UsersRound,
  GraduationCap,
  CalendarClock,
  HandCoins,
} from "lucide-react";
import { Horseshoe } from "@/components/ed/atoms";
import { addDays, CARE_META, type CareKind, type Deadline, type PlannedEvent, type Session } from "@/lib/domain/care";
import { useDataStore } from "@/stores/data-store";
import { HorseAvatar } from "@/components/horse/horse-avatar";
import { formatEur } from "@/lib/utils/format-currency";
import { localToday } from "@/lib/utils/local-date";

export function CareIcon({ kind, size = 15 }: { kind: CareKind; size?: number }) {
  const common = { size, strokeWidth: 1.8 };
  switch (kind) {
    case "vaccin":
      return <Syringe {...common} />;
    case "vermifuge":
      return <Pill {...common} />;
    case "ferrure":
      return <Horseshoe size={size + 1} stroke={1.8} />;
    case "dentiste":
      return <Smile {...common} />;
    case "osteo":
      return <Bone {...common} />;
    case "veto":
      return <Stethoscope {...common} />;
    case "soin":
      return <HeartPulse {...common} />;
    case "entrainement":
      return <Activity {...common} />;
    case "cours_collectif":
      return <UsersRound {...common} />;
    case "cours_individuel":
      return <GraduationCap {...common} />;
    case "concours":
      return <Trophy {...common} />;
    case "document":
      return <FileText {...common} />;
    case "prestation":
      return <HandCoins {...common} />;
  }
}

export function deadlinePhrase(d: Deadline): string {
  if (d.daysLeft < 0) return `en retard de ${Math.abs(d.daysLeft)} j`;
  if (d.daysLeft === 0) return "aujourd'hui";
  if (d.daysLeft === 1) return "demain";
  return `dans ${d.daysLeft} j`;
}

/**
 * Une échéance anticipée, actionnable sur place : « Fait ✓ » note l'acte du
 * jour et la prochaine échéance se replanifie toute seule ; « RDV » ouvre le
 * composeur prérempli (cheval, acte, date) pour caler le rendez-vous en un
 * geste. La boucle Flighty.
 */
export function DeadlineRow({
  d,
  horseName,
  showHorse = true,
}: {
  d: Deadline;
  horseName: string;
  showHorse?: boolean;
}) {
  const logCare = useDataStore((s) => s.logCare);
  const color =
    d.status === "overdue"
      ? "var(--c-danger)"
      : d.status === "soon"
        ? "var(--c-warning)"
        : "var(--text-tertiary)";
  const today = localToday();
  // Le RDV proposé : l'échéance — et jamais avant demain, pour qu'il reste
  // un rendez-vous à confirmer, pas un acte déjà fait.
  const tomorrow = addDays(today, 1);
  const rdvDate = d.dueDate > tomorrow ? d.dueDate : tomorrow;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="flex items-center gap-3 border-b border-[var(--border-default)] py-3"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full" style={{ color, background: "var(--bg-pressed)" }}>
        <CareIcon kind={d.kind} />
      </span>
      <Link href={`/cheval?id=${d.horseId}`} className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold leading-tight text-primary">
          {CARE_META[d.kind].label}
          {showHorse ? ` · ${horseName}` : ""}
        </p>
        <p className="text-[12px] font-semibold" style={{ color }}>
          {deadlinePhrase(d)}
          {d.plannedFor && (
            <span className="font-semibold text-secondary">
              {" "}· RDV le {d.plannedFor.slice(8, 10)}/{d.plannedFor.slice(5, 7)}
            </span>
          )}
        </p>
      </Link>
      {!d.plannedFor && (
        <Link
          href={`/saisie/soin?kind=${d.kind}&horses=${d.horseId}&date=${rdvDate}`}
          aria-label="Caler le rendez-vous"
          className="btn-ghost flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[12px]"
        >
          <CalendarClock size={13} /> RDV
        </Link>
      )}
      <button
        onClick={() =>
          logCare({ horseId: d.horseId, kind: d.kind, date: localToday() })
        }
        className="btn-ghost flex shrink-0 items-center gap-1 px-3 py-1.5 text-[12px]"
      >
        <Check size={13} /> Fait
      </button>
    </motion.li>
  );
}

export function agendaPhrase(daysUntil: number): string {
  if (daysUntil === 1) return "demain";
  return `dans ${daysUntil} j`;
}

/** Un rendez-vous de l'agenda : cours, concours, visite programmée. */
export function AgendaRow({
  p,
  horseName,
  showHorse = true,
}: {
  p: PlannedEvent;
  horseName: string;
  showHorse?: boolean;
}) {
  const e = p.event;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="flex items-center gap-3 border-b border-[var(--border-default)] py-3"
    >
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full"
        style={{ color: "var(--on-ink)", background: "var(--ink)" }}
      >
        <CareIcon kind={e.kind} />
      </span>
      <Link href={`/cheval?id=${e.horseId}`} className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold leading-tight text-primary">
          {CARE_META[e.kind].label}
          {showHorse ? ` · ${horseName}` : ""}
        </p>
        <p className="truncate text-[12px] font-semibold text-secondary">
          {agendaPhrase(p.daysUntil)}
          {e.label ? ` · ${e.label}` : ""}
        </p>
      </Link>
      <span className="shrink-0 text-tertiary">
        <CalendarClock size={16} strokeWidth={1.7} />
      </span>
    </motion.li>
  );
}

function sessionWhen(s: Session): { text: string; tone: "late" | "today" | "soon" } {
  if (s.daysUntil < 0)
    return { text: `à confirmer · ${s.date.slice(8, 10)}/${s.date.slice(5, 7)}`, tone: "late" };
  if (s.daysUntil === 0) return { text: "aujourd'hui", tone: "today" };
  if (s.daysUntil === 1) return { text: "demain", tone: "today" };
  return { text: `dans ${s.daysUntil} j`, tone: "soon" };
}

/**
 * Une séance de l'agenda : une ligne par cours/rendez-vous, tous les chevaux
 * dedans, et LE geste du gérant — la feuille de présence. Confirmer attribue
 * carnet, coûts et recettes aux chevaux réellement présents.
 */
export function SessionRow({
  s,
  horseName,
}: {
  s: Session;
  horseName: (id: string) => string;
}) {
  const confirmSession = useDataStore((st) => st.confirmSession);
  const [sheet, setSheet] = useState(false);
  const [present, setPresent] = useState<Set<string>>(new Set());

  const names = s.events.map((e) => horseName(e.horseId));
  const namesShort =
    names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  const when = sessionWhen(s);
  const tone =
    when.tone === "late" ? "var(--c-warning)" : when.tone === "today" ? "var(--text-primary)" : "var(--text-secondary)";
  const today = localToday();
  const actualDate = s.date <= today ? s.date : today;
  const revenue = s.events[0]?.revenue;

  function open() {
    setPresent(new Set(s.events.map((e) => e.horseId)));
    setSheet(true);
  }
  function toggle(id: string) {
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function confirm() {
    confirmSession(
      s.events.map((e) => e.id),
      [...present],
      actualDate,
    );
    setSheet(false);
  }

  return (
    <>
      <motion.li
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
        className="flex items-center gap-3 border-b border-[var(--border-default)] py-3"
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full"
          style={{ color: "var(--on-ink)", background: "var(--ink)" }}
        >
          <CareIcon kind={s.kind} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold leading-tight text-primary">
            {CARE_META[s.kind].label} · {namesShort}
          </p>
          <p className="truncate text-[12px] font-semibold" style={{ color: tone }}>
            {when.text}
            {s.label ? ` · ${s.label}` : ""}
            {s.provider ? ` · ${s.provider}` : ""}
          </p>
        </div>
        <button
          onClick={open}
          className="btn-ghost flex shrink-0 items-center gap-1 px-3 py-1.5 text-[12px]"
        >
          <Check size={13} /> {s.events.length > 1 ? "Présence" : "Fait"}
        </button>
      </motion.li>

      <AnimatePresence>
        {sheet && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              aria-label="Fermer"
              className="absolute inset-0"
              style={{ background: "var(--bg-overlay)" }}
              onClick={() => setSheet(false)}
            />
            <motion.div
              role="dialog"
              className="relative z-10 w-full max-w-[440px] rounded-t-[28px] bg-elevated px-6 pb-8 pt-3 shadow-[var(--shadow-floating)]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
            >
              <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border-strong)]" />
              <p className="title-serif text-[20px] text-primary">
                {CARE_META[s.kind].label}
                {s.label ? ` · ${s.label}` : ""}
              </p>
              <p className="mt-0.5 text-[13px] text-secondary">
                {s.events.length > 1 ? "Qui était là ? Décoche les absents." : "C'était bien fait ?"}
                {revenue ? ` ${formatEur(revenue)} par cheval présent.` : ""}
              </p>

              <ul className="mt-4 max-h-[40vh] overflow-y-auto">
                {s.events.map((e) => {
                  const on = present.has(e.horseId);
                  return (
                    <li key={e.id}>
                      <button
                        onClick={() => toggle(e.horseId)}
                        className="flex w-full items-center gap-3 border-b border-[var(--border-default)] py-2.5"
                      >
                        <HorseAvatar name={horseName(e.horseId)} size={30} />
                        <span
                          className="flex-1 text-left text-[15px] font-bold"
                          style={{
                            color: on ? "var(--text-primary)" : "var(--text-disabled)",
                            textDecoration: on ? "none" : "line-through",
                          }}
                        >
                          {horseName(e.horseId)}
                        </span>
                        <span
                          className="flex size-6 items-center justify-center rounded-full border"
                          style={{
                            background: on ? "var(--c-success)" : "transparent",
                            borderColor: on ? "var(--c-success)" : "var(--border-strong)",
                            color: "#fff",
                          }}
                        >
                          {on && <Check size={14} strokeWidth={3} />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <button
                onClick={confirm}
                className="btn-primary mt-5 flex w-full items-center justify-center gap-2 py-3.5 text-[15px] text-[var(--on-accent)]"
                style={present.size === 0 ? { background: "var(--c-danger)" } : undefined}
              >
                <Check size={18} />
                {present.size === 0
                  ? "Personne n'est venu · annuler la séance"
                  : `Confirmer${s.events.length > 1 ? ` · ${present.size} présent${present.size > 1 ? "s" : ""}` : ""}`}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
