"use client";

import { useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  Home,
  Layers,
  TrendingUp,
  Coins,
  Receipt,
  Settings,
  Compass as CompassIcon,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { VoiceCapture } from "@/components/entry/voice-capture";

interface RadialAction {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const ACTIONS: RadialAction[] = [
  { label: "Revenu", href: "/saisie/revenu", icon: <Coins size={18} /> },
  { label: "Charge", href: "/saisie/charge", icon: <Receipt size={18} /> },
  { label: "Mutualisée", href: "/saisie/mutualisee", icon: <Layers size={18} /> },
  { label: "Scénario", href: "/scenarios/nouveau", icon: <TrendingUp size={18} /> },
  { label: "Audit", href: "/audit", icon: <CompassIcon size={18} /> },
  { label: "Réglages", href: "/parametres", icon: <Settings size={18} /> },
];

/**
 * The Boussole (section 6.1.B): a permanent central "+" that fans out a
 * radial menu of six actions; a long-press launches voice capture; two
 * fixed side buttons go to "Maintenant" and "Mon écurie".
 */
export function Compass() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [voice, setVoice] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const startPress = () => {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setOpen(false);
      setVoice(true);
    }, 450);
  };
  const endPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (!longPressed.current) setOpen((o) => !o);
  };

  const sideBtn = (href: string, label: string, icon: React.ReactNode) => {
    const isActive = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className="flex flex-1 flex-col items-center gap-0.5 py-1"
        aria-label={label}
      >
        <span style={{ color: isActive ? "var(--accent-primary)" : "var(--text-tertiary)" }}>
          {icon}
        </span>
        <span
          className="text-[10px]"
          style={{ color: isActive ? "var(--text-primary)" : "var(--text-tertiary)" }}
        >
          {label}
        </span>
      </Link>
    );
  };

  return (
    <>
      {/* Scrim + radial menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            style={{ background: "var(--bg-overlay)" }}
          >
            <div className="absolute inset-x-0 bottom-28 mx-auto max-w-[480px]">
              <div className="relative mx-auto h-44 w-72">
                {ACTIONS.map((action, i) => {
                  const angle = Math.PI - (i / (ACTIONS.length - 1)) * Math.PI;
                  const r = 130;
                  const x = Math.cos(angle) * r;
                  const y = -Math.sin(angle) * r * 0.78;
                  return (
                    <motion.div
                      key={action.href}
                      className="absolute left-1/2 top-full"
                      initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
                      animate={{ x, y, opacity: 1, scale: 1 }}
                      exit={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.025 }}
                      style={{ translateX: "-50%" }}
                    >
                      <button
                        onClick={() => {
                          setOpen(false);
                          router.push(action.href);
                        }}
                        className="flex w-16 flex-col items-center gap-1"
                      >
                        <span className="flex size-12 items-center justify-center rounded-full border bg-elevated text-[var(--accent-primary)] shadow-[var(--shadow-floating)]">
                          {action.icon}
                        </span>
                        <span className="text-[10px] text-secondary">{action.label}</span>
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed bottom bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-[480px] items-end justify-between border-t bg-[var(--bg-base)]/95 px-6 pb-2 pt-2 backdrop-blur-md">
          {sideBtn("/maintenant", "Maintenant", <Home size={22} />)}

          <div className="relative -mt-7 flex flex-col items-center">
            <button
              aria-label="Actions"
              onMouseDown={startPress}
              onMouseUp={endPress}
              onMouseLeave={() => pressTimer.current && clearTimeout(pressTimer.current)}
              onTouchStart={startPress}
              onTouchEnd={endPress}
              className={cn(
                "flex size-16 items-center justify-center rounded-full shadow-[var(--shadow-floating)] transition-transform active:scale-95",
                voice && "ring-4 ring-[var(--c-danger)]",
              )}
              style={{ background: "var(--accent-primary)" }}
            >
              <motion.span animate={{ rotate: open ? 45 : 0 }} className="text-[var(--on-accent)]">
                {voice ? <Mic size={26} color="var(--on-accent)" /> : <Plus size={28} />}
              </motion.span>
            </button>
          </div>

          {sideBtn("/ecurie", "Mon écurie", <Layers size={22} />)}
        </div>
      </nav>

      <AnimatePresence>
        {voice && <VoiceCapture onClose={() => setVoice(false)} />}
      </AnimatePresence>
    </>
  );
}
