"use client";

import { Essayer } from "@/components/bs/essayer";

/**
 * La porte d'entrée : essayer avec ses chiffres, avant tout compte (voir
 * Essayer). L'ancien parcours de revendication de la fiche mon-ecurie.fr
 * reste sur /compte/inscription (?retrouver=1 pour chercher sa fiche).
 */
export default function BienvenuePage() {
  return <Essayer />;
}
