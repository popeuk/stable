"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Check, ChevronLeft, ArrowRight } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { HorseAvatar } from "@/components/horse/horse-avatar";
import { CareIcon } from "@/components/ed/care-bits";
import { useDataStore } from "@/stores/data-store";
import { useFlashStore } from "@/stores/flash-store";
import { CARE_KINDS, CARE_META, type CareKind } from "@/lib/domain/care";
import { cn } from "@/lib/utils/cn";
import { localToday } from "@/lib/utils/local-date";

/**
 * Noter un acte du carnet : « Ferrure pour Belle, 90 €, par M. Roche. »
 * Un coût saisi crée la dépense liée ; les actes à cadence replanifient
 * automatiquement la prochaine échéance.
 */
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function SaisieSoinPage() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <SoinComposer />
      </Suspense>
    </ClientGate>
  );
}

function SoinComposer() {
  const router = useRouter();
  const search = useSearchParams();
  const data = useDataStore();
  const logCare = useDataStore((s) => s.logCare);

  const horses = data.horses.filter((h) => !h.isArchived);
  const presetHorse = search.get("horse");

  const [horseId, setHorseId] = useState<string | null>(
    presetHorse && horses.some((h) => h.id === presetHorse) ? presetHorse : null,
  );
  const [kind, setKind] = useState<CareKind>("ferrure");
  const [date, setDate] = useState(localToday());
  const [provider, setProvider] = useState("");
  const [cost, setCost] = useState("");
  const [label, setLabel] = useState("");
  const [nextDue, setNextDue] = useState("");

  const horse = horses.find((h) => h.id === horseId);
  const today = localToday();
  const isPlanned = date > today;
  const costNum = Number(cost.replace(",", ".")) || 0;
  const canSave = !!horse;

  function save() {
    if (!horse) return;
    logCare({
      horseId: horse.id,
      kind,
      date,
      provider: provider.trim() || undefined,
      label: label.trim() || undefined,
      cost: costNum > 0 ? costNum : undefined,
      nextDue: nextDue || undefined,
    });
    useFlashStore.getState().setFlash({
      kind: "care",
      amount: costNum,
      label: `${CARE_META[kind].label} · ${horse.name}${isPlanned ? " (prévu)" : ""}`,
    });
    router.push(presetHorse ? `/cheval?id=${horse.id}` : "/planning");
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-tertiary">
        <ChevronLeft size={16} /> Annuler
      </button>

      <motion.p
        variants={item}
        className="sticky z-20 -mx-5 border-b border-[var(--border-default)] bg-base/95 px-5 py-3 font-[family-name:var(--font-fraunces)] text-[24px] leading-snug text-primary backdrop-blur-md"
        style={{ top: "env(safe-area-inset-top)" }}
      >
        <span style={{ color: "var(--text-primary)" }}>{CARE_META[kind].label}</span> pour{" "}
        <span style={{ color: horse ? "var(--text-primary)" : "var(--text-disabled)" }}>
          {horse?.name ?? "…"}
        </span>
        {costNum > 0 && (
          <span style={{ color: "var(--accent-primary)" }}> · {cost.replace(".", ",")} €</span>
        )}
        {isPlanned && (
          <span className="text-secondary">
            , pour le {date.slice(8, 10)}/{date.slice(5, 7)}
          </span>
        )}
        .
      </motion.p>

      {/* Quel acte */}
      <motion.div variants={item}>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-tertiary">
          Quel acte ?
        </p>
        <div className="flex flex-wrap gap-2">
          {CARE_KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold",
                kind === k
                  ? "border-[var(--text-primary)] bg-[var(--ink)] text-[var(--on-ink)]"
                  : "border-[var(--border-strong)] text-secondary",
              )}
            >
              <CareIcon kind={k} size={13} />
              {CARE_META[k].label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Quel cheval */}
      <motion.div variants={item}>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-tertiary">
          Pour qui ?
        </p>
        {horses.length === 0 ? (
          <Link
            href="/saisie/cheval"
            className="flex items-center justify-between rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] px-4 py-3.5"
          >
            <span className="pr-3 text-[13px] text-secondary">Ajoute d&apos;abord un cheval.</span>
            <span className="flex shrink-0 items-center gap-1 text-[13px] font-bold text-[var(--accent-primary)]">
              Ajouter <ArrowRight size={14} />
            </span>
          </Link>
        ) : (
          <div className="flex flex-wrap gap-2">
            {horses.map((h) => (
              <button
                key={h.id}
                onClick={() => setHorseId(h.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-[13px] font-bold",
                  horseId === h.id
                    ? "border-[var(--text-primary)] bg-[var(--ink)] text-[var(--on-ink)]"
                    : "border-[var(--border-strong)] text-primary",
                )}
              >
                <HorseAvatar name={h.name} size={22} />
                {h.name}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Détails */}
      <motion.div variants={item} className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-tertiary">Quand ?</p>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-elevated px-3 py-3 text-sm text-primary outline-none"
          />
        </div>
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-tertiary">
            Coût (optionnel)
          </p>
          <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-elevated px-3 py-3">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={cost}
              onChange={(e) => setCost(e.target.value.replace(/[^0-9,\.]/g, ""))}
              className="w-full bg-transparent text-sm tabular-nums text-primary outline-none"
            />
            <span className="text-sm text-tertiary">€</span>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-tertiary">
            Par qui ? (optionnel)
          </p>
          <input
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="Dr Lavigne, M. Roche…"
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-elevated px-3 py-3 text-sm text-primary outline-none"
          />
        </div>
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-tertiary">
            Détail (optionnel)
          </p>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Rappel grippe, 4 pieds…"
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-elevated px-3 py-3 text-sm text-primary outline-none"
          />
        </div>
      </motion.div>

      <motion.div variants={item}>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-tertiary">
          Échéance suivante (optionnel)
        </p>
        <input
          type="date"
          value={nextDue}
          onChange={(e) => setNextDue(e.target.value)}
          className="w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-elevated px-3 py-3 text-sm text-primary outline-none"
        />
        <p className="mt-1.5 text-[12px] text-tertiary">
          Renouvellement d&apos;un document, prochain rendez-vous fixé… Elle prime sur la cadence
          automatique.
        </p>
      </motion.div>

      {costNum > 0 && (
        <motion.p variants={item} className="text-[12px] text-tertiary">
          Le coût sera aussi inscrit au Journal comme dépense de {horse?.name ?? "ce cheval"} :
          une seule saisie, tout est relié.
        </motion.p>
      )}

      <motion.button
        variants={item}
        disabled={!canSave}
        onClick={save}
        className="flex w-full items-center justify-center gap-2 btn-primary py-3.5 text-[15px] text-[var(--on-accent)]"
      >
        <Check size={18} /> C&apos;est noté
      </motion.button>
    </motion.div>
  );
}
