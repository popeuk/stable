"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, ReceiptText, Settings, Plus } from "lucide-react";
import { HorseLine } from "@/components/ed/atoms";

/**
 * One bar, four places, one gesture. The centre button goes straight to the
 * composer — no intermediate menu, no sheet: saisir is ONE tap away, always.
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
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border-strong)] bg-base/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-[440px] grid-cols-5">
        <Tab tab={TABS[0]} active={isActive(TABS[0].href)} />
        <Tab tab={TABS[1]} active={isActive(TABS[1].href)} />

        <Link
          href="/saisie"
          aria-label="Saisir"
          className="flex flex-col items-center justify-center py-1.5"
        >
          <span
            className="flex size-9 items-center justify-center border border-[var(--text-primary)] transition-transform active:scale-95"
            style={{ background: "var(--accent-primary)", color: "#17150d" }}
          >
            <Plus size={20} />
          </span>
          <span className="mt-0.5 text-[10px] font-semibold text-tertiary">Saisir</span>
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
      className="relative flex flex-col items-center gap-1 py-2.5"
      style={{ color: active ? "var(--text-primary)" : "var(--text-tertiary)" }}
    >
      {active && (
        <span className="absolute top-0 h-[2px] w-8" style={{ background: "var(--text-primary)" }} />
      )}
      {tab.icon}
      <span className="text-[10px] font-semibold">{tab.label}</span>
    </Link>
  );
}
