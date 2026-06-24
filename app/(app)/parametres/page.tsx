"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Moon, Sun, RotateCcw, Bell, Tags, ChevronRight, Eraser, Landmark, PlayCircle } from "lucide-react";
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
  const setCapacity = useSettingsStore((s) => s.setCapacity);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = (localStorage.getItem("be-stable-theme") as "dark" | "light") || "dark";
    // Intentional: sync UI state from the persisted theme on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(stored);
    applyTheme(stored);
  }, []);

  function applyTheme(t: "dark" | "light") {
    if (t === "light") document.documentElement.setAttribute("data-theme", "light");
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
      <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">
        Paramètres
      </h1>

      <Section title="Écurie">
        <Row label="Nom de l'écurie" value="Écurie démo" />
        <Row label="Type" value="Pension simple" />
        <Row label="Chevaux actifs" value={`${activeHorses}`} />
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-secondary">Capacité d&apos;accueil</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCapacity(capacity - 1)}
              aria-label="moins"
              className="flex size-7 items-center justify-center border border-[var(--border-strong)] text-primary"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-bold tabular-nums text-primary">
              {capacity}
            </span>
            <button
              onClick={() => setCapacity(capacity + 1)}
              aria-label="plus"
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

      <Section title="Gérer">
        <NavRow href="/parametres/categories" icon={<Tags size={16} />} label="Catégories" />
        <NavRow href="/parametres/notifications" icon={<Bell size={16} />} label="Notifications" />
      </Section>

      <Section title="Données">
        <button
          onClick={() => {
            if (confirm("Réinitialiser avec les données de démonstration ?")) resetToDemo();
          }}
          className="flex w-full items-center gap-2 py-3 text-sm text-[var(--c-danger)]"
        >
          <RotateCcw size={16} /> Réinitialiser la démo
        </button>
        <button
          onClick={() => {
            if (confirm("Repartir de zéro ? Tout est vidé (chevaux, revenus, charges).")) startEmpty();
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
          <PlayCircle size={16} /> Revoir l&apos;intro
        </button>
      </Section>

      <Section title="À venir">
        <div className="flex items-center justify-between py-3">
          <span className="flex items-center gap-2 text-sm text-secondary">
            <Landmark size={16} /> Connexion bancaire
          </span>
          <span className="text-2xs font-bold uppercase text-tertiary">Bientôt</span>
        </div>
        <p className="pb-3 text-2xs text-tertiary">
          Importer automatiquement tes entrées et dépenses depuis ta banque (via un agrégateur), pour
          un suivi en temps réel.
        </p>
      </Section>

      <p className="pt-4 text-center text-2xs text-tertiary">Be Stable · v2.0 démo</p>
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
