"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSettingsStore } from "@/stores/settings-store";
import { useDataStore } from "@/stores/data-store";
import { getSession } from "@/lib/account/session";

/**
 * Le portier de l'app : sans session (ni compte, ni démo, ni écurie essayée
 * sur cet appareil), retour à l'accueil « Essayer avant le compte » ; avec
 * une écurie pas encore installée, direction le parcours, sauf s'il a
 * choisi de le finir plus tard. L'écurie essayée sans compte suit le même
 * chemin qu'un compte : tant que son parcours n'est pas fini, /parcours.
 * Il attend que les données du compte soient chargées avant de décider.
 */
/**
 * Où envoyer le visiteur (null = il reste où il est). La démo est une écurie
 * déjà installée : elle n'est jamais renvoyée vers le parcours.
 */
export function gateTarget(
  kind: "compte" | "demo" | "locale" | null,
  parcours: { chevaux: boolean; tarifs: boolean; factures: boolean },
  plusTard: boolean,
  path: string,
): string | null {
  if (!kind) return "/bienvenue";
  if (kind === "demo") return null;
  const setup = parcours.chevaux && parcours.tarifs && parcours.factures;
  const libre = ["/parcours", "/bienvenue", "/compte", "/ma-fiche"].some((p) => path.startsWith(p));
  return !setup && !plusTard && !libre ? "/parcours" : null;
}

export function OnboardingGate() {
  const router = useRouter();
  const path = usePathname() ?? "";
  const parcours = useSettingsStore((s) => s.parcours);
  const plusTard = useSettingsStore((s) => s.parcoursPlusTard);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const check = () => useDataStore.persist.hasHydrated() && useSettingsStore.persist.hasHydrated() && setReady(true);
    check();
    const a = useDataStore.persist.onFinishHydration(check);
    const b = useSettingsStore.persist.onFinishHydration(check);
    return () => {
      a();
      b();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const to = gateTarget(getSession()?.kind ?? null, parcours, plusTard, path);
    if (to) router.replace(to);
  }, [ready, parcours, plusTard, path, router]);

  return null;
}
