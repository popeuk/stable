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
import { weekdayOf, WEEKDAY_LABELS } from "@/lib/domain/rhythm";
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
  const logCareMany = useDataStore((s) => s.logCareMany);
  const addRhythm = useDataStore((s) => s.addRhythm);

  const horses = data.horses.filter((h) => !h.isArchived);
  const presetHorse = search.get("horse");
  // Préremplissage complet (le vocal et les liens profonds passent par là).
  const presetIds = (search.get("horses") ?? presetHorse ?? "")
    .split(",")
    .filter((hid) => horses.some((h) => h.id === hid));
  const presetKind = search.get("kind") as CareKind | null;

  const [horseIds, setHorseIds] = useState<Set<string>>(() => new Set(presetIds));
  const [kind, setKind] = useState<CareKind>(
    presetKind && CARE_KINDS.includes(presetKind) ? presetKind : "ferrure",
  );
  const [date, setDate] = useState(search.get("date") ?? localToday());
  const [provider, setProvider] = useState(search.get("provider") ?? "");
  const [cost, setCost] = useState(search.get("cost") ?? "");
  const [revenue, setRevenue] = useState(search.get("revenue") ?? "");
  const [label, setLabel] = useState(search.get("label") ?? "");
  const [nextDue, setNextDue] = useState("");
  const [weekly, setWeekly] = useState(false);

  const selected = horses.filter((h) => horseIds.has(h.id));
  const allSelected = selected.length === horses.length && horses.length > 0;
  const today = localToday();
  const isPlanned = date > today;
  const isCours = kind === "cours_collectif" || kind === "cours_individuel" || kind === "concours";
  const canRepeat =
    kind === "cours_collectif" || kind === "cours_individuel" || kind === "entrainement";
  const costNum = Number(cost.replace(",", ".")) || 0;
  const revenueNum = Number(revenue.replace(",", ".")) || 0;
  const canSave = selected.length > 0;

  function toggleHorse(hid: string) {
    setHorseIds((prev) => {
      const next = new Set(prev);
      if (next.has(hid)) next.delete(hid);
      else next.add(hid);
      return next;
    });
  }

  function save() {
    if (!canSave) return;
    logCareMany(
      selected.map((h) => h.id),
      {
        kind,
        date,
        provider: provider.trim() || undefined,
        label: label.trim() || undefined,
        cost: costNum > 0 ? costNum : undefined,
        revenue: isCours && revenueNum > 0 ? revenueNum : undefined,
        nextDue: nextDue || undefined,
      },
    );
    // Le rythme : cette séance revient chaque semaine, générée toute seule.
    // La borne part de la date saisie — l'occurrence du jour vient d'être créée.
    if (weekly) {
      addRhythm({
        kind,
        weekday: weekdayOf(date),
        label: label.trim() || undefined,
        provider: provider.trim() || undefined,
        horseIds: selected.map((h) => h.id),
        revenue: isCours && revenueNum > 0 ? revenueNum : undefined,
        cost: costNum > 0 ? costNum : undefined,
        active: true,
        materializedUntil: date,
      });
    }
    const who =
      selected.length === 1 ? selected[0].name : `${selected.length} chevaux`;
    useFlashStore.getState().setFlash({
      kind: "care",
      amount: costNum,
      label: `${CARE_META[kind].label} · ${who}${isPlanned ? " (prévu)" : ""}`,
    });
    router.push(presetHorse ? `/cheval?id=${presetHorse}` : "/planning");
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
        <span style={{ color: selected.length ? "var(--text-primary)" : "var(--text-disabled)" }}>
          {selected.length === 0
            ? "…"
            : selected.length <= 2
              ? selected.map((h) => h.name).join(", ")
              : `${selected[0].name} +${selected.length - 1}`}
        </span>
        {costNum > 0 && (
          <span style={{ color: "var(--accent-primary)" }}> · {cost.replace(".", ",")} €</span>
        )}
        {isCours && revenueNum > 0 && (
          <span style={{ color: "var(--c-success)" }}>
            {" "}· {revenue.replace(".", ",")} €/cheval
          </span>
        )}
        {isPlanned && (
          <span className="text-secondary">
            , pour le {date.slice(8, 10)}/{date.slice(5, 7)}
          </span>
        )}
        {weekly && (
          <span className="text-secondary">, chaque {WEEKDAY_LABELS[weekdayOf(date)]}</span>
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
            <button
              onClick={() =>
                setHorseIds(allSelected ? new Set() : new Set(horses.map((h) => h.id)))
              }
              className={cn(
                "rounded-full border px-3 py-1.5 text-[13px] font-bold",
                allSelected
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]"
                  : "border-dashed border-[var(--border-strong)] text-secondary",
              )}
            >
              Tous
            </button>
            {horses.map((h) => (
              <button
                key={h.id}
                onClick={() => toggleHorse(h.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-[13px] font-bold",
                  horseIds.has(h.id)
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

      {isCours && (
        <motion.div variants={item}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-tertiary">
            Recette par cheval (optionnel)
          </p>
          <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-elevated px-3 py-3">
            <input
              type="text"
              inputMode="decimal"
              placeholder="25"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value.replace(/[^0-9,\.]/g, ""))}
              className="w-full bg-transparent text-sm tabular-nums text-primary outline-none"
            />
            <span className="text-sm text-tertiary">€ / cheval</span>
          </div>
          <p className="mt-1.5 text-[12px] text-tertiary">
            Attribuée à chaque cheval présent quand tu confirmes la séance.
          </p>
        </motion.div>
      )}

      {canRepeat && (
        <motion.div variants={item}>
          <button
            onClick={() => setWeekly((w) => !w)}
            className={cn(
              "flex w-full items-center justify-between rounded-[var(--radius-md)] border px-4 py-3",
              weekly
                ? "border-[var(--accent-primary)] bg-[var(--accent-primary-soft)]"
                : "border-[var(--border-strong)]",
            )}
          >
            <span className="text-left">
              <span className="block text-[14px] font-bold text-primary">
                Répéter chaque {WEEKDAY_LABELS[weekdayOf(date)]}
              </span>
              <span className="block text-[12px] text-secondary">
                La séance apparaîtra toute seule à l&apos;agenda, chaque semaine.
              </span>
            </span>
            <span
              aria-hidden
              className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
              style={{ background: weekly ? "var(--accent-primary)" : "var(--border-strong)" }}
            >
              <span
                className="absolute top-0.5 size-5 rounded-full bg-white transition-all"
                style={{ left: weekly ? "22px" : "2px" }}
              />
            </span>
          </button>
        </motion.div>
      )}

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
          Le coût sera inscrit au Journal pour chaque cheval concerné :
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
