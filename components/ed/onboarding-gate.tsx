"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * Sends a first-time visitor through the 3-step intro before the app opens.
 * Runs after mount (the flag lives in localStorage), so there's no SSR loop.
 */
export function OnboardingGate() {
  const router = useRouter();
  const onboarded = useSettingsStore((s) => s.onboarded);
  const [mounted, setMounted] = useState(false);

  // Intentional: mark mounted once so we don't redirect before rehydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !onboarded) router.replace("/onboarding");
  }, [mounted, onboarded, router]);

  return null;
}
