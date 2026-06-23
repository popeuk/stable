"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Elegant install toast (spec 14.4). Surfaces after a few visits on Android
 * (beforeinstallprompt). Dismissals are remembered.
 */
export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("be-stable-install-dismissed")) return;

    const visits = Number(localStorage.getItem("be-stable-visits") ?? "0") + 1;
    localStorage.setItem("be-stable-visits", String(visits));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (visits >= 3) setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem("be-stable-install-dismissed", "1");
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="fixed inset-x-0 bottom-24 z-50 mx-auto max-w-[440px] px-5"
        >
          <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border bg-elevated p-4 shadow-[var(--shadow-floating)]">
            <span className="flex size-9 items-center justify-center rounded-full bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]">
              <Download size={18} />
            </span>
            <div className="flex-1">
              <p className="text-sm text-primary">Installe Be Stable</p>
              <p className="text-2xs text-tertiary">
                Plus rapide à ouvrir, dispo hors ligne.
              </p>
            </div>
            <button
              onClick={install}
              className="rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium text-[#0e0f0c]"
              style={{ background: "var(--accent-primary)" }}
            >
              Installer
            </button>
            <button onClick={dismiss} aria-label="Fermer" className="text-tertiary">
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
