"use client";

import dynamic from "next/dynamic";
import { ClientGate } from "@/components/ui/client-gate";
import { Page } from "@/components/carnet/ui";
import "@/app/carnet/accueil-fort.css";
import { AccueilPresence } from "@/components/bs/accueil-presence";
import { ARGENT_VISIBLE } from "@/lib/fonctions";

/**
 * L'accueil de la partie argent vit à part (components/bs/accueil-argent.tsx) et ne se charge que
 * si elle est allumée : sans elle, l'accueil de la présence en ligne reste sous le plafond de poids
 * (scripts/poids-accueil.mjs, 230 Ko).
 */
const AccueilArgent = dynamic(() => import("@/components/bs/accueil-argent").then((m) => m.AccueilArgent), { ssr: false });

/**
 * L'accueil, dans l'ordre : le chiffre du mois (le personnage à côté) et, sans aucun frais, ce qui lui
 * manque ; le chemin en cinq pas d'une écurie qui démarre
 * (components/bs/accueil-fort.tsx) ; puis la
 * ligne « Hier : … ont compté » qui ouvre la tournée du matin si on veut,
 * ta journée en pleine largeur, une seule chose à faire à la fois (fin du
 * mois, ou des chevaux à nommer), et l'encart mon-ecurie.fr réduit, tout en
 * bas. À la première visite, une bulle montre le + ; la carte d'aide
 * complète s'ouvre sous le chiffre quand on touche le « ? ».
 * Sur ordinateur : le chiffre en grand à gauche, ta journée à droite et
 * l'équipe dessous.
 */
export default function AccueilPage() {
  // La partie argent masquée (lib/fonctions.ts) : l'accueil de la présence en ligne, pour tous.
  if (!ARGENT_VISIBLE)
    return (
      <ClientGate>
        <Page className="pr-page">
          <AccueilPresence />
        </Page>
      </ClientGate>
    );
  return (
    <ClientGate>
      <AccueilArgent />
    </ClientGate>
  );
}
