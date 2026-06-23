"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

type SyncState = "synced" | "syncing" | "error" | "local";

/**
 * Discreet sync badge (section 5.2 / 13.5). In this build there is no remote
 * backend, so it reflects browser connectivity: online = local-first synced,
 * offline = local-only mode.
 */
export function SyncIndicator() {
  const [state, setState] = useState<SyncState>("synced");

  useEffect(() => {
    const update = () => setState(navigator.onLine ? "synced" : "local");
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const config: Record<SyncState, { color: string; label: string; pulse: boolean }> = {
    synced: { color: "var(--c-success)", label: "Synchronisé", pulse: false },
    syncing: { color: "#5b8def", label: "Synchronisation…", pulse: true },
    error: { color: "var(--c-danger)", label: "Erreur de synchro", pulse: false },
    local: { color: "var(--text-tertiary)", label: "Mode local", pulse: true },
  };
  const c = config[state];

  return (
    <div
      className="flex items-center gap-1.5 text-2xs text-tertiary"
      title={c.label}
      aria-label={c.label}
    >
      <span
        className={cn("size-1.5 rounded-full", c.pulse && "animate-pulse")}
        style={{ backgroundColor: c.color }}
      />
    </div>
  );
}
