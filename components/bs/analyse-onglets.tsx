"use client";

import { usePathname, useRouter } from "next/navigation";
import { TeteVerte } from "@/components/da/tete-verte";
import { Onglets } from "@/components/da/onglets";
import { QUATRE_PARTIES } from "@/lib/fonctions";
import { ANALYSE_ONGLETS } from "@/components/bs/navigation";

/**
 * Les onglets du haut de l'Analyse (26 novembre 2026, les cinq onglets) :
 * Rentabilité (Mon bilan), Offre (l'offre face au département), Visibilité
 * (l'audit). Posés dans la coque, au-dessus de la porte des briques : ils
 * restent là quand une partie est encore à ouvrir.
 */
const ONGLETS: [string, string, string][] = [
  ["/argent", "Rentabilité", "Ce que ton écurie te laisse, mois par mois."],
  ["/te-choisir", "Offre", "Ton offre face aux écuries autour de toi."],
  ["/te-trouver", "Visibilité", "Ce qu’un cavalier trouve de toi en cherchant."],
];

/**
 * DA de l'app du Clos (27 novembre 2026) : l'en-tête vert « Analyse », une
 * phrase qui dit la partie ouverte, puis les trois parties en pastilles.
 * Rien de lourd ici : ce composant est dans la coque de tous les écrans.
 */
export function AnalyseOnglets() {
  const router = useRouter();
  const path = (usePathname() ?? "").replace(/(.)\/$/, "$1");
  if (!QUATRE_PARTIES || !ANALYSE_ONGLETS.includes(path)) return null;
  const ici = ONGLETS.find(([href]) => href === path);
  return (
    <nav className="da-ana" aria-label="Analyse">
      <TeteVerte titre="Analyse" sous={ici?.[2]} />
      <Onglets label="Les parties de l’Analyse" items={ONGLETS.map(([href, nom]) => ({ key: href, titre: nom, on: path === href, go: () => path !== href && router.replace(href) }))} />
    </nav>
  );
}
