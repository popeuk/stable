"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { House, ReceiptText, Settings, Plus, Coins, Receipt, Layers, Repeat, X } from "lucide-react";
import { HorseLine } from "@/components/ed/atoms";

const TABS = [
  { href: "/maintenant", label: "Aujourd’hui", icon: <House size={20} strokeWidth={1.7} /> },
  { href: "/ecurie", label: "Écurie", icon: <HorseLine size={22} stroke={1.7} /> },
  { href: "/depenses", label: "Dépenses", icon: <ReceiptText size={19} strokeWidth={1.7} /> },
  { href: "/parametres", label: "Réglages", icon: <Settings size={19} strokeWidth={1.7} /> },
];

const ENTRIES = [
  {
    href: "/saisie/revenu",
    label: "Une rentrée d'argent",
    desc: "Pension, cours, vente…",
    icon: <Coins size={18} />,
  },
  {
    href: "/saisie/charge",
    label: "Une dépense",
    desc: "Pour un seul cheval (véto, maréchal…)",
    icon: <Receipt size={18} />,
  },
  {
    href: "/saisie/mutualisee",
    label: "Une dépense partagée",
    desc: "Répartie sur toute l'écurie (foin, paille…)",
    icon: <Layers size={18} />,
  },
  {
    href: "/saisie/recurrente",
    label: "Une dépense qui revient",
    desc: "Crédit, assurance, abonnement…",
    icon: <Repeat size={18} />,
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <button className="absolute inset-0" style={{ background: "var(--bg-overlay)" }} aria-label="Fermer" />
            <motion.div
              className="relative z-10 mb-24 w-full max-w-[440px] px-5"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
            >
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--bg-base)]">
                Saisie éclair
              </p>
              <div className="border border-[var(--text-primary)] bg-elevated">
                {ENTRIES.map((e) => (
                  <Link
                    key={e.href}
                    href={e.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 border-b border-[var(--border-default)] px-4 py-3.5 last:border-b-0"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center border border-[var(--border-strong)] text-[var(--accent-primary)]">
                      {e.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold leading-tight text-primary">
                        {e.label}
                      </span>
                      <span className="block text-[12px] leading-tight text-tertiary">{e.desc}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border-strong)] bg-base"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-[440px] grid-cols-5">
          <Tab tab={TABS[0]} active={isActive(TABS[0].href)} />
          <Tab tab={TABS[1]} active={isActive(TABS[1].href)} />

          <button
            onClick={() => setOpen((o) => !o)}
            className="flex flex-col items-center justify-center py-1.5"
            aria-label="Saisir"
          >
            <span
              className="flex size-9 items-center justify-center"
              style={{ background: "var(--accent-primary)", color: "#17150d" }}
            >
              <motion.span animate={{ rotate: open ? 45 : 0 }}>
                {open ? <X size={20} /> : <Plus size={20} />}
              </motion.span>
            </span>
            <span className="mt-0.5 text-[10px] font-semibold text-tertiary">Saisir</span>
          </button>

          <Tab tab={TABS[2]} active={isActive(TABS[2].href)} />
          <Tab tab={TABS[3]} active={isActive(TABS[3].href)} />
        </div>
      </nav>
    </>
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
