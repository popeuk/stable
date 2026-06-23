"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Moon, Sun, RotateCcw, Bell, Tags, ChevronRight } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { useDataStore } from "@/stores/data-store";

export default function ParametresPage() {
  return (
    <ClientGate>
      <Parametres />
    </ClientGate>
  );
}

function Parametres() {
  const resetToDemo = useDataStore((s) => s.resetToDemo);
  const activeHorses = useDataStore(
    (s) => s.horses.filter((h) => !h.isArchived).length,
  );
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
