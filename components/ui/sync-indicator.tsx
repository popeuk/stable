"use client";

import { cn } from "@/lib/utils/cn";
import { useSync, type SyncStatus } from "@/lib/hooks/use-sync";

/**
 * Discreet sync badge (spec 5.2 / 13.5), four states. Driven by the sync
 * engine: when a remote is configured it reflects queue draining; otherwise it
 * shows local-only / offline based on connectivity.
 */
export function SyncIndicator() {
  const { status, pending } = useSync();

  const config: Record<
    SyncStatus,
    { color: string; label: string; pulse: boolean }
  > = {
    synced: { color: "var(--c-success)", label: "Synchronisé", pulse: false },
    syncing: { color: "#5b8def", label: "Synchronisation…", pulse: true },
    error: { color: "var(--c-danger)", label: "Erreur de synchro", pulse: false },
    local: { color: "var(--text-tertiary)", label: "Mode local", pulse: true },
  };
  const c = config[status];
  const label = pending > 0 ? `${c.label} · ${pending} en attente` : c.label;

  return (
    <div
      className="flex items-center gap-1.5 text-2xs text-tertiary"
      title={label}
      aria-label={label}
    >
      <span
        className={cn("size-1.5 rounded-full", c.pulse && "animate-pulse")}
        style={{ backgroundColor: c.color }}
      />
    </div>
  );
}
