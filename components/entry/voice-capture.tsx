"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";

type Phase = "listening" | "parsing" | "confirm";

/**
 * Voice capture overlay (section 9.8 / 12.1). The real product streams the
 * audio to an Edge Function (Whisper + Claude parsing). Here the UI flow is
 * fully built and the parse step is simulated so it works without a backend.
 */
export function VoiceCapture({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("listening");

  // Simulated transcript → parsed transaction.
  const parsed = {
    summary: "80 € de granulés pour Belle",
    type: "Charge directe",
  };

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("parsing"), 1800);
    const t2 = setTimeout(() => setPhase("confirm"), 2800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-8"
      style={{ background: "var(--bg-overlay)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {phase !== "confirm" ? (
        <>
          <p className="mb-12 text-lg text-primary">
            {phase === "listening" ? "Je t'écoute…" : "Je réfléchis…"}
          </p>
          <motion.div
            className="flex size-40 items-center justify-center rounded-full"
            style={{ background: "var(--c-danger-soft)" }}
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
          >
            <motion.div
              className="size-24 rounded-full"
              style={{ background: "var(--c-danger)" }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
            />
          </motion.div>
          <button onClick={onClose} className="mt-12 text-sm text-tertiary">
            Annuler
          </button>
        </>
      ) : (
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-sm rounded-[var(--radius-xl)] border bg-elevated p-6 text-center"
        >
          <p className="text-2xs uppercase tracking-wide text-tertiary">J&apos;ai compris</p>
          <p className="mt-2 font-[family-name:var(--font-fraunces)] text-2xl text-primary">
            {parsed.summary}
          </p>
          <p className="mt-1 text-sm text-secondary">{parsed.type} · c&apos;est ça ?</p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => {
                router.push("/saisie/charge");
                onClose();
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border py-3 text-sm text-secondary"
            >
              <Pencil size={16} /> Corriger
            </button>
            <button
              onClick={onClose}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] py-3 text-sm font-medium text-[#0e0f0c]"
              style={{ background: "var(--accent-primary)" }}
            >
              <Check size={16} /> Valider
            </button>
          </div>
          <p className="mt-4 text-[10px] text-tertiary">
            Démo : transcription simulée. La saisie vocale réelle passe par
            Whisper + Claude.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
