"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { HorseLine, Horseshoe } from "@/components/ed/atoms";
import { useSettingsStore } from "@/stores/settings-store";

interface Step {
  kicker: string;
  title: string;
  body: string;
  /** Les deux teintes du champ de pouls derrière le visuel. */
  pulse: [string, string];
  visual: React.ReactNode;
}

const STEPS: Step[] = [
  {
    kicker: "1 · Comprendre",
    title: "Sache ce que chaque cheval te rapporte vraiment.",
    body: "Pensions, charges, marge — cheval par cheval, en clair. Fini le doute sur qui porte ton écurie et qui pèse dessus.",
    pulse: ["rgba(227, 165, 43, 0.30)", "rgba(124, 144, 112, 0.22)"],
    visual: (
      <div className="relative flex h-full items-center justify-center">
        <HorseLine size={160} stroke={0.9} color="var(--text-primary)" />
        <div className="absolute bottom-6 right-6 border border-[var(--text-primary)] bg-[var(--bg-base)] px-3 py-2">
          <p className="text-[10px] font-bold uppercase text-tertiary">Marge</p>
          <p className="font-[family-name:var(--font-fraunces)] text-xl" style={{ color: "var(--c-success)" }}>
            +320 €
          </p>
        </div>
      </div>
    ),
  },
  {
    kicker: "2 · Être accompagné",
    title: "Ton copilote te conseille, en euros.",
    body: "Pas juste des constats : des actions concrètes et chiffrées (remplir une place, renégocier un poste), et il suit ce que tu décides.",
    pulse: ["rgba(124, 144, 112, 0.28)", "rgba(227, 165, 43, 0.18)"],
    visual: (
      <div className="flex h-full items-center justify-center p-6">
        <div className="w-full border border-[var(--text-primary)] bg-[var(--text-primary)] p-4 text-[var(--bg-base)]">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--accent-primary)]">
            Ton copilote
          </p>
          <p className="mt-1.5 text-[14px] font-semibold leading-snug">
            Remplis tes 2 places libres
          </p>
          <span className="mt-2 inline-block bg-[var(--accent-primary)] px-2 py-1 text-[12px] font-extrabold text-[#17150d]">
            ≈ +900 €/mois
          </span>
        </div>
      </div>
    ),
  },
  {
    kicker: "3 · Apprendre en faisant",
    title: "Chaque chiffre s'explique, sur tes données.",
    body: "Touche un terme, une notion s'ouvre — appliquée à ton écurie. Tu montes en compétence sans cours, juste en utilisant l'app.",
    pulse: ["rgba(232, 181, 71, 0.28)", "rgba(124, 144, 112, 0.16)"],
    visual: (
      <div className="flex h-full items-center justify-center p-6">
        <div className="w-full border border-[var(--border-strong)] bg-[var(--bg-base)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--accent-primary)]">
            Notion · 2 min
          </p>
          <p className="mt-1 font-[family-name:var(--font-fraunces)] text-lg text-primary">
            La marge nette
          </p>
          <p className="mt-1 text-[12px] text-secondary">
            Ce qu&apos;il te reste vraiment, une fois toutes tes charges payées.
          </p>
        </div>
      </div>
    ),
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const complete = useSettingsStore((s) => s.completeOnboarding);
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  function finish() {
    complete();
    router.replace("/maintenant");
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col bg-base px-6 pb-8 pt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Horseshoe size={18} stroke={2} />
          <span className="text-[16px] font-extrabold text-primary">Be Stable</span>
        </div>
        {!last && (
          <button onClick={finish} className="text-[13px] font-semibold text-tertiary">
            Passer
          </button>
        )}
      </div>

      {/* Visual */}
      <div className="mt-6 overflow-hidden border border-[var(--border-strong)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
            className="grain aspect-[4/3]"
          >
            <div
              aria-hidden
              className="pulse-field absolute inset-0"
              style={
                { "--pulse-a": step.pulse[0], "--pulse-b": step.pulse[1] } as React.CSSProperties
              }
            />
            <div className="relative h-full">{step.visual}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Texte */}
      <div className="mt-7 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--accent-primary)]">
              {step.kicker}
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-[28px] leading-tight text-primary">
              {step.title}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-secondary">{step.body}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots */}
      <div className="mb-5 flex items-center gap-2">
        {STEPS.map((_, n) => (
          <button
            key={n}
            onClick={() => setI(n)}
            aria-label={`Étape ${n + 1}`}
            className="h-1.5 transition-all"
            style={{
              width: n === i ? 24 : 8,
              background: n === i ? "var(--text-primary)" : "var(--border-strong)",
            }}
          />
        ))}
      </div>

      <button
        onClick={() => (last ? finish() : setI(i + 1))}
        className="flex items-center justify-between border border-[var(--text-primary)] bg-[var(--text-primary)] py-3 pl-5 pr-3 text-[var(--bg-base)]"
      >
        <span className="text-[16px] font-bold">{last ? "Commencer" : "Suivant"}</span>
        <span
          className="flex size-9 items-center justify-center"
          style={{ background: "var(--accent-primary)", color: "#17150d" }}
        >
          <ArrowRight size={18} />
        </span>
      </button>
    </div>
  );
}
