"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore, type NoterPrefill } from "@/stores/ui-store";
import { rechercheCampagne } from "@/lib/mesure";

const installee = (p: { chevaux?: boolean; tarifs?: boolean; factures?: boolean }) => !!(p.chevaux && p.tarifs && p.factures);

/** Les anciennes adresses mènent aux nouveaux écrans (liens et favoris gardés). */
export function Redirect({ to, keepQuery }: { to?: string; keepQuery?: boolean }) {
  const router = useRouter();
  const parcours = useSettingsStore((s) => s.parcours);
  useEffect(() => {
    const target = to ?? (installee(parcours) ? "/accueil" : "/bienvenue");
    // Les paramètres de campagne d'une publicité suivent toujours (lib/mesure) : sinon l'entrée « / » les perd.
    router.replace(`${target}${keepQuery ? window.location.search : rechercheCampagne(window.location.search)}`);
  }, [to, keepQuery, parcours, router]);
  return null;
}

/**
 * Les anciens écrans de saisie (/saisie, /saisie/soin, /saisie/charge…) :
 * on ouvre la feuille du + au bon endroit, par-dessus la fiche du cheval
 * (?horse=…) ou l'accueil. Tant que l'écurie n'est pas installée, on
 * renvoie seulement vers le parcours, sans feuille.
 */
export function NoterRedirect({ prefill }: { prefill: (q: URLSearchParams) => NoterPrefill }) {
  const router = useRouter();
  const parcours = useSettingsStore((s) => s.parcours);
  useEffect(() => {
    if (!installee(parcours)) {
      router.replace("/bienvenue");
      return;
    }
    const q = new URLSearchParams(window.location.search);
    const horse = q.get("horse");
    useUiStore.getState().openNoter({ ...prefill(q), ...(horse ? { horseIds: [horse] } : {}) });
    router.replace(horse ? `/ticket?id=${encodeURIComponent(horse)}` : "/accueil");
  }, [parcours, prefill, router]);
  return null;
}
