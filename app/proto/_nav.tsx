"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, GraduationCap, PencilLine } from "lucide-react";
import { HorseLine } from "./_ui";

const TABS = [
  { href: "/proto/aujourdhui", label: "Aujourd’hui", icon: <House size={21} strokeWidth={1.7} /> },
  { href: "/proto/cheval", label: "Chevaux", icon: <HorseLine size={22} stroke={1.7} /> },
  { href: "/proto/lecon", label: "Apprendre", icon: <GraduationCap size={21} strokeWidth={1.7} /> },
  { href: "/proto/saisie", label: "Saisir", icon: <PencilLine size={20} strokeWidth={1.7} /> },
];

/** Barre d'onglets bas, pensée comme une vraie app. Fine, carrée. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--o-line-strong)] bg-[var(--o-bg)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-[440px] grid-cols-4">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative flex flex-col items-center gap-1 py-2.5"
              style={{ color: active ? "var(--o-ink)" : "var(--o-muted)" }}
            >
              {active && (
                <span
                  className="absolute top-0 h-[2px] w-9"
                  style={{ background: "var(--o-ink)" }}
                />
              )}
              {tab.icon}
              <span className="text-[10.5px] font-semibold">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
