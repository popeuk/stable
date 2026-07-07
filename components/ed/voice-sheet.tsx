"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, Check, Keyboard, Pencil, Sparkles } from "lucide-react";
import { CareIcon } from "@/components/ed/care-bits";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useFlashStore } from "@/stores/flash-store";
import { CARE_META } from "@/lib/domain/care";
import { interpretLocal, type Command } from "@/lib/domain/interpret";
import { interpretLLM } from "@/lib/ai/openrouter";
import { localToday } from "@/lib/utils/local-date";
import { formatEur } from "@/lib/utils/format-currency";

/**
 * L'assistant : tu parles (ou tu tapes), il comprend, il te montre ce qu'il
 * va faire, tu confirmes. Jamais d'action aveugle. LLM (clé OpenRouter de
 * l'utilisateur) quand elle est là, interpréteur local sinon — et toujours
 * le repli « Corriger » vers le composeur prérempli.
 */
type Phase = "idle" | "listening" | "thinking" | "preview" | "notfound";

// L'API Web Speech n'est pas typée partout : accès prudent.
type Recognition = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | (new () => Recognition)
    | undefined;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = "fr-FR";
  r.interimResults = false;
  return r;
}

export function VoiceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const data = useDataStore();
  const logCareMany = useDataStore((s) => s.logCareMany);
  const apiKey = useSettingsStore((s) => s.openRouterKey);

  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState("");
  const [command, setCommand] = useState<Command | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [usedLLM, setUsedLLM] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const canListen = typeof window !== "undefined" && getRecognition() !== null;

  const horses = data.horses.filter((h) => !h.isArchived);
  const ctx = { horses: horses.map((h) => ({ id: h.id, name: h.name })), today: localToday() };
  const nameOf = (id: string) => horses.find((h) => h.id === id)?.name ?? "";

  useEffect(() => {
    if (!open) {
      // Intentional: reset the sheet state when it closes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("idle");
      setText("");
      setCommand(null);
      recRef.current?.stop();
    }
  }, [open]);

  function listen() {
    const rec = getRecognition();
    if (!rec) return;
    recRef.current = rec;
    setPhase("listening");
    rec.onresult = (ev) => {
      const transcript = ev.results[0]?.[0]?.transcript ?? "";
      setText(transcript);
      void understand(transcript);
    };
    rec.onerror = () => setPhase("idle");
    rec.onend = () => setPhase((p) => (p === "listening" ? "idle" : p));
    rec.start();
  }

  async function understand(input: string) {
    const t = input.trim();
    if (!t) return;
    setPhase("thinking");
    let cmd: Command | null = null;
    let llm = false;
    if (apiKey) {
      cmd = await interpretLLM(t, ctx, apiKey);
      llm = cmd !== null;
    }
    if (!cmd) {
      const local = interpretLocal(t, ctx);
      cmd = local.command;
      setMissing(local.missing);
    }
    setUsedLLM(llm);
    setCommand(cmd);
    setPhase(cmd ? "preview" : "notfound");
  }

  function confirm() {
    if (!command) return;
    logCareMany(command.horseIds, {
      kind: command.kind,
      date: command.date,
      cost: command.cost,
      revenue: command.revenue,
      provider: command.provider,
      label: command.label,
    });
    const who =
      command.horseIds.length === 1
        ? nameOf(command.horseIds[0])
        : `${command.horseIds.length} chevaux`;
    useFlashStore.getState().setFlash({
      kind: "care",
      amount: command.cost ?? 0,
      label: `${CARE_META[command.kind].label} · ${who}${command.date > ctx.today ? " (prévu)" : ""}`,
    });
    onClose();
    router.push("/maintenant");
  }

  function correct() {
    const c = command;
    onClose();
    const q = new URLSearchParams();
    if (c) {
      q.set("kind", c.kind);
      q.set("horses", c.horseIds.join(","));
      q.set("date", c.date);
      if (c.cost) q.set("cost", String(c.cost));
      if (c.revenue) q.set("revenue", String(c.revenue));
      if (c.label) q.set("label", c.label);
      if (c.provider) q.set("provider", c.provider);
    }
    router.push(`/saisie/soin?${q.toString()}`);
  }

  const previewDate = command
    ? command.date === ctx.today
      ? "aujourd'hui"
      : `le ${command.date.slice(8, 10)}/${command.date.slice(5, 7)}`
    : "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            aria-label="Fermer"
            className="absolute inset-0"
            style={{ background: "var(--bg-overlay)" }}
            onClick={onClose}
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
            <p className="title-serif text-[20px] text-primary">Dis-moi ce qu&apos;il se passe</p>
            <p className="mt-0.5 text-[13px] text-secondary">
              « Cours collectif demain 14 h avec Belle et Pacha, 25 euros »
            </p>

            {/* L'écoute / la saisie */}
            <div className="mt-4 flex items-start gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void understand(text);
                  }
                }}
                rows={2}
                placeholder={phase === "listening" ? "Je t'écoute…" : "Parle ou écris ici…"}
                className="min-h-[64px] flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-base px-3 py-2.5 text-[15px] text-primary outline-none"
              />
              {canListen ? (
                <button
                  onClick={listen}
                  aria-label="Parler"
                  className="flex size-16 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: phase === "listening" ? "var(--c-danger)" : "var(--accent-primary)",
                    color: "var(--on-accent)",
                    animation: phase === "listening" ? "pulse-drift 1.2s infinite" : undefined,
                  }}
                >
                  <Mic size={26} />
                </button>
              ) : (
                <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-tertiary">
                  <Keyboard size={22} />
                </span>
              )}
            </div>

            {text.trim() && phase !== "preview" && phase !== "thinking" && (
              <button
                onClick={() => void understand(text)}
                className="btn-primary mt-3 flex w-full items-center justify-center gap-2 py-3 text-[14px] text-[var(--on-accent)]"
              >
                <Sparkles size={16} /> Comprendre
              </button>
            )}

            {phase === "thinking" && (
              <p className="mt-4 text-center text-[13px] font-semibold text-tertiary">
                {apiKey ? "Je réfléchis…" : "J'interprète…"}
              </p>
            )}

            {/* L'aperçu : ce que je vais faire */}
            {phase === "preview" && command && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-base p-4"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--accent-primary)]">
                  {usedLLM ? "Compris (IA)" : "Compris"}
                </p>
                <p className="mt-1.5 flex items-start gap-2 text-[16px] font-bold leading-snug text-primary">
                  <span className="mt-0.5 shrink-0 text-tertiary">
                    <CareIcon kind={command.kind} size={17} />
                  </span>
                  <span>
                    {CARE_META[command.kind].label} {previewDate}
                    {command.label ? ` · ${command.label}` : ""} —{" "}
                    {command.all
                      ? "toute l'écurie"
                      : command.horseIds.map(nameOf).join(", ")}
                    {command.revenue ? (
                      <span style={{ color: "var(--c-success)" }}>
                        {" "}· {formatEur(command.revenue)}/cheval
                      </span>
                    ) : null}
                    {command.cost ? (
                      <span style={{ color: "var(--accent-primary)" }}>
                        {" "}· {formatEur(command.cost)}
                      </span>
                    ) : null}
                  </span>
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={confirm}
                    className="btn-primary flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[14px] text-[var(--on-accent)]"
                  >
                    <Check size={16} /> C&apos;est ça
                  </button>
                  <button
                    onClick={correct}
                    className="btn-ghost flex items-center gap-1.5 px-4 py-2.5 text-[13px]"
                  >
                    <Pencil size={14} /> Corriger
                  </button>
                </div>
              </motion.div>
            )}

            {phase === "notfound" && (
              <div className="mt-4 rounded-[var(--radius-lg)] bg-[var(--c-warning-soft)] p-4">
                <p className="text-[14px] font-bold text-primary">
                  Il me manque {missing.length ? missing.join(" et ") : "des détails"}.
                </p>
                <p className="mt-1 text-[13px] text-secondary">
                  Reformule, ou passe par la saisie guidée.
                </p>
                <button
                  onClick={correct}
                  className="btn-ghost mt-3 flex items-center gap-1.5 px-4 py-2 text-[13px]"
                >
                  <Pencil size={14} /> Saisie guidée
                </button>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-[var(--border-default)] pt-3 text-[12px] text-tertiary">
              <button onClick={correct} className="font-semibold">
                Saisie manuelle
              </button>
              <span>{apiKey ? "IA connectée" : "Mode local · ajoute ta clé dans Réglages"}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
