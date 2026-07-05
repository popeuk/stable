"use client";

import Link from "next/link";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { Horseshoe } from "@/components/ed/atoms";
import { CARE_META, type CareKind, type Deadline } from "@/lib/domain/care";
import { useDataStore } from "@/stores/data-store";

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
    case "concours":
      return <Trophy {...common} />;
    case "document":
      return <FileText {...common} />;
  }
}

export function deadlinePhrase(d: Deadline): string {
  if (d.daysLeft < 0)
    return `en retard de ${Math.abs(d.daysLeft)} j`;
  if (d.daysLeft === 0) return "aujourd'hui";
  return `dans ${d.daysLeft} j`;
}

/**
 * Une échéance anticipée, actionnable sur place : « Fait ✓ » note l'acte du
 * jour et la prochaine échéance se replanifie toute seule. La boucle Flighty.
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
        </p>
      </Link>
      <button
        onClick={() =>
          logCare({ horseId: d.horseId, kind: d.kind, date: new Date().toISOString().slice(0, 10) })
        }
        className="btn-ghost flex shrink-0 items-center gap-1 px-3 py-1.5 text-[12px]"
      >
        <Check size={13} /> Fait
      </button>
    </motion.li>
  );
}
