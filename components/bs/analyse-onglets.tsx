"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { QUATRE_PARTIES } from "@/lib/fonctions";
import { ANALYSE_ONGLETS } from "@/components/bs/navigation";

/**
 * Les onglets du haut de l'Analyse (26 novembre 2026, les cinq onglets) :
 * Rentabilité (Mon bilan), Offre (l'offre face au département), Visibilité
 * (l'audit). Posés dans la coque, au-dessus de la porte des briques : ils
 * restent là quand une partie est encore à ouvrir.
 */
const ONGLETS: [string, string][] = [
  ["/argent", "Rentabilité"],
  ["/te-choisir", "Offre"],
  ["/te-trouver", "Visibilité"],
];

export function AnalyseOnglets() {
  const path = (usePathname() ?? "").replace(/(.)\/$/, "$1");
  if (!QUATRE_PARTIES || !ANALYSE_ONGLETS.includes(path)) return null;
  return (
    <nav className="q5-ana" aria-label="Analyse">
      <h1 className="q5-ana-t">Analyse</h1>
      <div className="q5-ana-o">
        {ONGLETS.map(([href, nom]) => (
          <Link key={href} href={href} aria-current={path === href ? "page" : undefined} replace>
            {nom}
          </Link>
        ))}
      </div>
    </nav>
  );
}
