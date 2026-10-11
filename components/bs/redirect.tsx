"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSettingsStore } from "@/stores/settings-store";

/** Les anciennes adresses mènent aux nouveaux écrans (liens et favoris gardés). */
export function Redirect({ to, keepQuery }: { to?: string; keepQuery?: boolean }) {
  const router = useRouter();
  const parcours = useSettingsStore((s) => s.parcours);
  useEffect(() => {
    const target = to ?? (parcours.chevaux && parcours.tarifs && parcours.factures ? "/accueil" : "/bienvenue");
    router.replace(keepQuery ? `${target}${window.location.search}` : target);
  }, [to, keepQuery, parcours, router]);
  return null;
}
