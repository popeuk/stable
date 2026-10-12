"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Moon, Sun, RotateCcw, Bell, Tags, ChevronRight, Eraser, Landmark, PlayCircle, BadgeEuro, UsersRound } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";

export default function ParametresPage() {
  return (
    <ClientGate>
      <Parametres />
    </ClientGate>
  );
}

function Parametres() {
  const router = useRouter();
  const resetToDemo = useDataStore((s) => s.resetToDemo);
  const startEmpty = useDataStore((s) => s.startEmpty);
  const resetOnboarding = useSettingsStore((s) => s.resetOnboarding);
  const activeHorses = useDataStore(
    (s) => s.horses.filter((h) => !h.isArchived).length,
  );
  const capacity = useSettingsStore((s) => s.capacity);
  const openRouterKey = useSettingsStore((s) => s.openRouterKey);
  const setOpenRouterKey = useSettingsStore((s) => s.setOpenRouterKey);
  const setCapacity = useSettingsStore((s) => s.setCapacity);
  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    // Warm light is the default theme; dark is opt-in (data-theme="dark").
    const stored = (localStorage.getItem("be-stable-theme") as "dark" | "light") || "light";
    // Intentional: sync UI state from the persisted theme on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(stored);
    applyTheme(stored);
  }, []);

  function applyTheme(t: "dark" | "light") {
    if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem("be-stable-theme", next);
  }

  return (
    <div className="space-y-6">
      <h1 className="font-[family-name:var(--font-bricolage)] text-2xl text-primary">
        Paramètres
      </h1>

      <Section title="Ton écurie">
        <Row label="Nom de l'écurie" value="Écurie démo" />
        <Row label="Type" value="Pension simple" />
        <Row label="Chevaux chez toi" value={`${activeHorses}`} />
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-secondary">Nombre de boxes</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCapacity(capacity - 1)}
              aria-label="Un box de moins"
              className="flex size-7 items-center justify-center border border-[var(--border-strong)] text-primary"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-bold tabular-nums text-primary">
              {capacity}
            </span>
            <button
              onClick={() => setCapacity(capacity + 1)}
              aria-label="Un box de plus"
              className="flex size-7 items-center justify-center border border-[var(--border-strong)] text-primary"
            >
              +
            </button>
          </div>
        </div>
      </Section>

      <Section title="Apparence">
        <button onClick={toggleTheme} className="flex w-full items-center justify-between py-3">
          <span className="flex items-center gap-2 text-sm text-primary">
            {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
            Thème {theme === "dark" ? "sombre" : "clair"}
          </span>
          <span className="text-2xs text-[var(--accent-primary)]">Changer</span>
        </button>
      </Section>

      <Section title="Assistant vocal">
        <div className="py-3">
          <p className="text-sm text-primary">Clé OpenRouter (facultatif)</p>
          <p className="mt-0.5 text-2xs text-tertiary">
            Sans clé, l&apos;assistant marche quand même et comprend les phrases simples. Avec une clé
            OpenRouter, il comprend mieux. Ta clé reste sur ce téléphone et n&apos;est envoyée qu&apos;à OpenRouter.
          </p>
          <input
            type="password"
            value={openRouterKey}
            onChange={(e) => setOpenRouterKey(e.target.value)}
            placeholder="sk-or-…"
            autoComplete="off"
            className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-base px-3 py-2.5 text-sm text-primary outline-none"
          />
          {openRouterKey && (
            <p className="mt-1.5 text-2xs font-semibold" style={{ color: "var(--c-success)" }}>
              Clé enregistrée · l’assistant passe par OpenRouter
            </p>
          )}
        </div>
      </Section>

      <Section title="Réglages">
        <NavRow href="/parametres/tarifs" icon={<BadgeEuro size={16} />} label="Tarifs et prestations" />
        <NavRow href="/parametres/equipe" icon={<UsersRound size={16} />} label="L'équipe" />
        <NavRow href="/parametres/categories" icon={<Tags size={16} />} label="Catégories" />
        <NavRow href="/parametres/notifications" icon={<Bell size={16} />} label="Notifications" />
      </Section>

      <Section title="Tes données">
        <button
          onClick={() => {
            if (confirm("Remettre l’écurie d’exemple ? Ce que tu as noté sera remplacé.")) resetToDemo();
          }}
          className="flex w-full items-center gap-2 py-3 text-sm text-[var(--c-danger)]"
        >
          <RotateCcw size={16} /> Remettre l&apos;écurie d&apos;exemple
        </button>
        <button
          onClick={() => {
            if (confirm("Repartir de zéro ? Tout sera effacé : chevaux, ce qui rentre, ce qui sort.")) startEmpty();
          }}
          className="flex w-full items-center gap-2 py-3 text-sm text-primary"
        >
          <Eraser size={16} /> Repartir de zéro (écurie vide)
        </button>
        <button
          onClick={() => {
            resetOnboarding();
            router.push("/onboarding");
          }}
          className="flex w-full items-center gap-2 py-3 text-sm text-primary"
        >
          <PlayCircle size={16} /> Revoir la présentation
        </button>
      </Section>

      <Section title="Pas encore là">
        <div className="flex items-center justify-between py-3">
          <span className="flex items-center gap-2 text-sm text-secondary">
            <Landmark size={16} /> Connexion bancaire
          </span>
          <span className="text-2xs font-bold uppercase text-tertiary">Pas encore</span>
        </div>
        <p className="pb-3 text-2xs text-tertiary">
          Récupérer tout seul ce qui rentre et ce qui sort de ton compte en banque. Ce n&apos;est pas encore
          possible : pour l&apos;instant, tu le notes dans l&apos;app.
        </p>
      </Section>

      <p className="pt-4 text-center text-2xs text-tertiary">Be Stable · v4 « Grand Ouvert »</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 text-2xs uppercase tracking-wide text-tertiary">{title}</h2>
      <div className="divide-y rounded-[var(--radius-lg)] border bg-elevated px-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <span className="text-secondary">{label}</span>
      <span className="text-primary">{value}</span>
    </div>
  );
}

function NavRow({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link href={href} className="flex w-full items-center justify-between py-3.5">
      <span className="flex items-center gap-2 text-sm text-primary">
        <span className="text-tertiary">{icon}</span>
        {label}
      </span>
      <ChevronRight size={16} className="text-tertiary" />
    </Link>
  );
}
