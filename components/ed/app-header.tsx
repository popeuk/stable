"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Settings } from "lucide-react";
import { Horseshoe } from "@/components/ed/atoms";

/**
 * L'en-tête de marque : le logo et le nom, bien visibles, et LA porte
 * d'entrée des réglages — c'est là qu'on paramètre toute son écurie
 * (tarifs, prestations, équipe, catégories). Remplace la frise des mois,
 * jolie mais inutile au quotidien.
 */
export function AppHeader() {
  const pathname = usePathname();
  // Pendant une saisie ou une recherche, place au geste : pas d'en-tête.
  if (pathname.startsWith("/saisie") || pathname.startsWith("/recherche")) return null;

  return (
    <div className="sticky top-0 z-30 border-b border-[var(--border-default)] bg-base/95 backdrop-blur-md">
      <div
        className="mx-auto flex max-w-[440px] items-center justify-between px-5 py-2.5"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
      >
        <Link href="/maintenant" className="flex items-center gap-2.5">
          <span
            className="flex size-9 items-center justify-center rounded-full"
            style={{ background: "var(--ink)", color: "var(--on-ink)" }}
          >
            <Horseshoe size={18} stroke={2} />
          </span>
          <span className="font-[family-name:var(--font-fraunces)] text-[21px] italic leading-none text-primary">
            Be Stable
          </span>
        </Link>
        <span className="flex items-center gap-1.5">
          <Link
            href="/recherche"
            aria-label="Rechercher"
            className="flex size-9 items-center justify-center rounded-full border border-[var(--border-strong)] text-secondary"
          >
            <Search size={17} strokeWidth={1.8} />
          </Link>
          <Link
            href="/parametres"
            aria-label="Réglages de l'écurie"
            className="flex size-9 items-center justify-center rounded-full border border-[var(--border-strong)] text-secondary"
          >
            <Settings size={18} strokeWidth={1.8} />
          </Link>
        </span>
      </div>
    </div>
  );
}
