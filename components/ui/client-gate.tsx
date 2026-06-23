"use client";

import { useEffect, useState } from "react";

/**
 * Renders children only after mount. The data store rehydrates from
 * localStorage on the client, so gating avoids SSR/client mismatches.
 */
export function ClientGate({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  // Intentional: flip to client-rendered exactly once after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="size-6 animate-pulse rounded-full bg-[var(--accent-primary-soft)]" />
      </div>
    );
  }
  return <>{children}</>;
}
