"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TeteVerte } from "@/components/da/tete-verte";
import { Onglets } from "@/components/da/onglets";
import { QUATRE_PARTIES } from "@/lib/fonctions";
import { SuiviTete } from "@/components/da/suivi-tete";
import { ANALYSE_ONGLETS } from "@/components/bs/navigation";

/**
 * Les têtes vertes posées dans la coque (DA de l'app du Clos), chargées à
 * part (components/bs/analyse-onglets-differe.tsx) : Analyse, Suivi, Vitrine.
 *
 * Analyse (27 novembre 2026, comme au Clos) : l'audit en trois volets, Te
 * trouver, Te choisir, En vivre (lib/audit/grille.ts).
 */
const ONGLETS: [string, string, string][] = [
  ["/te-trouver", "Te trouver", "Est-ce que les cavaliers tombent sur ton écurie ?"],
  ["/te-choisir", "Te choisir", "Ce qu’ils comparent avant de t’écrire."],
  ["/en-vivre", "En vivre", "Ce que chaque cheval te laisse au bout du mois."],
];

export function AnalyseOnglets() {
  const router = useRouter();
  const path = (usePathname() ?? "").replace(/(.)\/$/, "$1");
  if (!QUATRE_PARTIES || !ANALYSE_ONGLETS.includes(path)) return null;
  const ici = ONGLETS.find(([href]) => href === path);
  return (
    <nav className="da-ana" aria-label="Analyse">
      <TeteVerte titre="Analyse" sous={ici?.[2]} />
      <Onglets label="Les volets de l’audit" items={ONGLETS.map(([href, nom]) => ({ key: href, titre: nom, on: path === href, go: () => path !== href && router.replace(href) }))} />
    </nav>
  );
}

/**
 * Suivi (27 novembre 2026, comme au Clos) : l'argent du mois, en deux onglets,
 * Bilan et Revenus et frais (/argent et /argent?vue=mouvements). Les idées
 * pour gagner plus restent sous le Bilan.
 */
export function SuiviOnglets() {
  const router = useRouter();
  const path = (usePathname() ?? "").replace(/(.)\/$/, "$1");
  const vue = useSearchParams().get("vue");
  if (!QUATRE_PARTIES || path !== "/argent") return null;
  const frais = vue === "mouvements";
  return (
    <nav className="da-ana" aria-label="Suivi">
      <TeteVerte titre="Suivi" sous="Ce que le mois rapporte et ce qu’il coûte.">
        <SuiviTete />
      </TeteVerte>
      <Onglets
        label="Bilan, revenus et frais"
        items={[
          { key: "bilan", titre: "Bilan", petit: "le mois", on: !frais, go: () => frais && router.replace("/argent") },
          { key: "frais", titre: "Revenus et frais", petit: "tout ce qui est noté", on: frais, go: () => !frais && router.replace("/argent?vue=mouvements") },
        ]}
      />
    </nav>
  );
}

const VITRINE: [string, string, string][] = [
  ["/ma-fiche", "Ma fiche", "Ce que voient les cavaliers sur bestable.fr."],
  ["/mon-site", "Mon site", "Ton site, fait à partir de ta fiche."],
];

/**
 * La Vitrine (DA de l'app du Clos, 27 novembre 2026) : l'en-tête vert, une
 * phrase, puis Ma fiche et Mon site en pastilles. Dans la coque, comme
 * l'Analyse ; chargé à part (components/bs/analyse-onglets-differe.tsx).
 */
export function VitrineOnglets() {
  const router = useRouter();
  const path = (usePathname() ?? "").replace(/(.)\/$/, "$1");
  if (!QUATRE_PARTIES || !VITRINE.some(([href]) => href === path)) return null;
  const ici = VITRINE.find(([href]) => href === path);
  return (
    <nav className="da-ana" aria-label="Vitrine">
      <TeteVerte titre="Vitrine" sous={ici?.[2]} />
      <Onglets label="Les parties de la Vitrine" items={VITRINE.map(([href, nom]) => ({ key: href, titre: nom, on: path === href, go: () => path !== href && router.replace(href) }))} />
    </nav>
  );
}
