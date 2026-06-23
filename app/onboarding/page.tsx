"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { KeyNumber } from "@/components/ui/key-number";
import { formatEur } from "@/lib/utils/format-currency";

type Estimate = {
  horses: number;
  pension: number;
  fixedCosts: number;
  variableCost: number;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [est, setEst] = useState<Estimate>({
    horses: 12,
    pension: 450,
    fixedCosts: 2500,
    variableCost: 180,
  });

  const result =
    est.horses * est.pension - est.fixedCosts - est.horses * est.variableCost;

  const next = () => setStep((s) => s + 1);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-6 py-10">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <Step key="welcome">
            <div className="flex flex-1 flex-col justify-center">
              <h1 className="font-[family-name:var(--font-fraunces)] text-4xl leading-tight text-primary">
                Bienvenue. Avant tout, on va répondre à une question simple.
              </h1>
              <p className="mt-4 text-lg text-secondary">
                Combien rapporte vraiment ton écurie ?
              </p>
            </div>
            <PrimaryButton onClick={next}>Commencer</PrimaryButton>
          </Step>
        )}

        {step === 1 && (
          <Step key="horses">
            <Question title="Combien de chevaux en pension chez toi ?">
              <Stepper
                value={est.horses}
                min={1}
                max={50}
                onChange={(v) => setEst((e) => ({ ...e, horses: v }))}
              />
            </Question>
            <PrimaryButton onClick={next}>Suivant</PrimaryButton>
          </Step>
        )}

        {step === 2 && (
          <Step key="pension">
            <Question title="Quelle pension moyenne par mois ?">
              <BigSlider
                value={est.pension}
                min={100}
                max={1500}
                step={10}
                suffix="€"
                onChange={(v) => setEst((e) => ({ ...e, pension: v }))}
              />
            </Question>
            <PrimaryButton onClick={next}>Suivant</PrimaryButton>
          </Step>
        )}

        {step === 3 && (
          <Step key="fixed">
            <Question title="Tes charges fixes par mois, à la louche ?">
              <BigSlider
                value={est.fixedCosts}
                min={500}
                max={5000}
                step={50}
                suffix="€"
                onChange={(v) => setEst((e) => ({ ...e, fixedCosts: v }))}
              />
              <p className="mt-3 text-sm text-tertiary">
                Loyer, salaires, abos, assurance. Pas grave si c&apos;est approximatif.
              </p>
            </Question>
            <PrimaryButton onClick={next}>Suivant</PrimaryButton>
          </Step>
        )}

        {step === 4 && (
          <Step key="variable">
            <Question title="Combien chaque cheval te coûte en variable ?">
              <BigSlider
                value={est.variableCost}
                min={50}
                max={400}
                step={5}
                suffix="€"
                onChange={(v) => setEst((e) => ({ ...e, variableCost: v }))}
              />
            </Question>
            <PrimaryButton onClick={next}>Voir le résultat</PrimaryButton>
          </Step>
        )}

        {step === 5 && (
          <Step key="aha">
            <div className="flex flex-1 flex-col justify-center text-center">
              <p className="text-sm text-tertiary">Ton résultat mensuel estimé</p>
              <div className="my-4">
                <KeyNumber value={result} colorBySign className="text-5xl" />
              </div>
              <div className="mx-auto mt-4 w-full max-w-xs space-y-1 text-left text-sm text-secondary">
                <Line label="Revenus estimés" value={est.horses * est.pension} />
                <Line label="Charges fixes" value={-est.fixedCosts} />
                <Line label="Charges variables" value={-est.horses * est.variableCost} />
              </div>
              <p className="mt-6 text-base" style={{ color: result >= 0 ? "var(--c-success)" : "var(--c-danger)" }}>
                {result >= 0
                  ? "À première vue, ton écurie est rentable. Plongeons dans le détail."
                  : "À première vue, ton écurie perd de l'argent chaque mois. Voyons exactement où."}
              </p>
            </div>
            <PrimaryButton onClick={() => router.push("/maintenant")}>
              Voir le détail cheval par cheval
            </PrimaryButton>
          </Step>
        )}
      </AnimatePresence>
    </div>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col justify-center">
      <h2 className="mb-10 font-[family-name:var(--font-fraunces)] text-2xl text-primary">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-6">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex size-14 items-center justify-center rounded-full border text-2xl text-primary"
      >
        −
      </button>
      <span className="w-20 text-center font-[family-name:var(--font-fraunces)] text-5xl tabnums text-primary">
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex size-14 items-center justify-center rounded-full border text-2xl text-primary"
      >
        +
      </button>
    </div>
  );
}

function BigSlider({
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="mb-6 text-center font-[family-name:var(--font-fraunces)] text-5xl tabnums text-primary">
        {new Intl.NumberFormat("fr-FR").format(value)} {suffix}
      </p>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent-primary)]"
        style={{ height: 32 }}
      />
    </div>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="tabnums text-primary">{formatEur(value)}</span>
    </div>
  );
}

function PrimaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="mt-6 w-full rounded-[var(--radius-md)] py-4 text-base font-medium text-[#0e0f0c]"
      style={{ background: "var(--accent-primary)" }}
    >
      {children}
    </button>
  );
}
