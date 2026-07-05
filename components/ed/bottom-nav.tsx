"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, ReceiptText, Settings, Plus } from "lucide-react";
import { HorseLine } from "@/components/ed/atoms";

/**
 * Le dock : une pilule vert chasse qui flotte au-dessus du canvas. Quatre
 * lieux, et le + cognac au centre qui mène droit au composeur.
 */
const TABS = [
  { href: "/maintenant", label: "Aujourd’hui", icon: <House size={20} strokeWidth={1.7} /> },
  { href: "/ecurie", label: "Écurie", icon: <HorseLine size={22} stroke={1.7} /> },
  { href: "/depenses", label: "Journal", icon: <ReceiptText size={19} strokeWidth={1.7} /> },
  { href: "/parametres", label: "Réglages", icon: <Settings size={19} strokeWidth={1.7} /> },
];

export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 z-50"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 14px)" }}
    >
      <div
        className="pointer-events-auto mx-auto grid w-[min(420px,calc(100%-32px))] grid-cols-5 items-center rounded-full px-2 py-1.5"
        style={{ background: "var(--ink)", boxShadow: "var(--shadow-floating)" }}
      >
        <Tab tab={TABS[0]} active={isActive(TABS[0].href)} />
        <Tab tab={TABS[1]} active={isActive(TABS[1].href)} />

        <Link href="/saisie" aria-label="Saisir" className="flex items-center justify-center">
          <span
            className="flex size-12 items-center justify-center rounded-full transition-transform active:scale-90"
            style={{ background: "var(--accent-primary)", color: "var(--on-accent)" }}
          >
            <Plus size={24} strokeWidth={2.2} />
          </span>
        </Link>

        <Tab tab={TABS[2]} active={isActive(TABS[2].href)} />
        <Tab tab={TABS[3]} active={isActive(TABS[3].href)} />
      </div>
    </nav>
  );
}

function Tab({
  tab,
  active,
}: {
  tab: { href: string; label: string; icon: React.ReactNode };
  active: boolean;
}) {
  return (
    <Link
      href={tab.href}
      className="flex flex-col items-center gap-0.5 py-1.5 transition-opacity"
      style={{ color: "var(--on-ink)", opacity: active ? 1 : 0.55 }}
    >
      {tab.icon}
      <span className="text-[9px] font-semibold">{tab.label}</span>
    </Link>
  );
}
