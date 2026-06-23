"use client";

import { useEffect, useState } from "react";
import { isRemoteConfigured } from "@/lib/data/supabase";
import { pendingCount, processPendingSync } from "@/lib/data/sync";

export type SyncStatus = "synced" | "syncing" | "error" | "local";

/**
 * Drives the sync engine from the client (spec section 13): drains the queue
 * on mount, when the network returns, and every 30s. When no remote is
 * configured it reports "local" and does nothing.
 */
export function useSync() {
  const [status, setStatus] = useState<SyncStatus>(
    isRemoteConfigured() ? "synced" : "local",
  );
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!isRemoteConfigured()) {
      const onOffline = () => setStatus("local");
      const onOnline = () => setStatus("synced");
      window.addEventListener("offline", onOffline);
      window.addEventListener("online", onOnline);
      return () => {
        window.removeEventListener("offline", onOffline);
        window.removeEventListener("online", onOnline);
      };
    }

    let cancelled = false;

    async function drain() {
      if (cancelled || !navigator.onLine) return;
      setStatus("syncing");
      const result = await processPendingSync();
      if (cancelled) return;
      setPending(pendingCount());
      setStatus(result && result.failed > 0 ? "error" : "synced");
    }

    void drain();
    const interval = setInterval(drain, 30_000);
    window.addEventListener("online", drain);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("online", drain);
    };
  }, []);

  return { status, pending };
}
