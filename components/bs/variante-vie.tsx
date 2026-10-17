"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Propositions « plus de vie » (17 octobre 2026) : ?v=a, ?v=b ou ?v=c pose
 * une variante de style sur l'app, gardée le temps de la visite ; ?v=0 la
 * retire. L'écran courant est aussi posé (data-ecran) pour les chapitres de
 * couleur. Sans paramètre, rien ne change.
 */
const CLE = "be-stable-vie";

export function VarianteVie() {
  const path = usePathname();
  const sp = useSearchParams();
  const v = sp.get("v");
  const vue = sp.get("vue");
  useEffect(() => {
    const html = document.documentElement;
    try {
      if (v === "0") sessionStorage.removeItem(CLE);
      else if (v && /^[abc]$/.test(v)) sessionStorage.setItem(CLE, v);
      const cur = sessionStorage.getItem(CLE);
      if (cur) html.dataset.vie = cur;
      else delete html.dataset.vie;
    } catch {
      /* Sans stockage : rien. */
    }
    const ecran = path.includes("/chevaux") && vue === "clients" ? "clients" : path.includes("/planning") ? "planning" : path.includes("/argent") ? "mois" : path.includes("/accueil") ? "accueil" : path.includes("/chevaux") ? "chevaux" : "autre";
    html.dataset.ecran = ecran;
  }, [path, v, vue]);
  return null;
}
