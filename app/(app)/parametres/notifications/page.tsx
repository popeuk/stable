"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { useSettingsStore, type NotificationPrefs } from "@/stores/settings-store";

const ITEMS: { key: keyof NotificationPrefs; title: string; desc: string }[] = [
  {
    key: "weeklyInsight",
    title: "Le point de la semaine",
    desc: "Le dimanche soir, ce qu’il faut retenir de ta semaine.",
  },
  {
    key: "monthlyAudit",
    title: "Le bilan du mois",
    desc: "Le 1er du mois, ce que le mois passé t’a laissé, en 5 cartes.",
  },
  {
    key: "horseAlerts",
    title: "Un cheval qui coûte",
    desc: "Quand un cheval commence à te coûter plus qu’il ne rapporte.",
  },
];

export default function NotificationsPage() {
  return (
    <ClientGate>
      <Notifications />
    </ClientGate>
  );
}

function Notifications() {
  const prefs = useSettingsStore((s) => s.notifications);
  const toggle = useSettingsStore((s) => s.toggle);

  return (
    <div className="space-y-5">
      <Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-tertiary">
        <ChevronLeft size={16} /> Réglages
      </Link>
      <div>
        <h1 className="font-[family-name:var(--font-bricolage)] text-2xl text-primary">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-tertiary">
          Tu choisis ce que tu veux recevoir. Pas de rappel pour te culpabiliser.
        </p>
      </div>

      <div className="divide-y rounded-[var(--radius-lg)] border bg-elevated px-4">
        {ITEMS.map((item) => {
          const on = prefs[item.key];
          return (
            <div key={item.key} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm text-primary">{item.title}</p>
                <p className="mt-0.5 text-2xs text-tertiary">{item.desc}</p>
              </div>
              <button
                onClick={() => toggle(item.key)}
                role="switch"
                aria-checked={on}
                aria-label={item.title}
                className="relative h-6 w-10 shrink-0 rounded-full transition-colors"
                style={{ background: on ? "var(--accent-primary)" : "var(--bg-pressed)" }}
              >
                <span
                  className="absolute top-0.5 size-5 rounded-full bg-white transition-all"
                  style={{ left: on ? 18 : 2 }}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
