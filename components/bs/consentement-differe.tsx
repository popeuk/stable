"use client";

import dynamic from "next/dynamic";

/**
 * Le bandeau des cookies, chargé à part : sans identifiant de mesure posé au
 * build (le cas tant que GA_ID et META_PIXEL sont vides), rien ne se charge ;
 * sinon il arrive juste après le premier affichage (components/bs/consentement.tsx).
 */
const Consentement = dynamic(() => import("@/components/bs/consentement").then((m) => m.Consentement), { ssr: false });
const POSEE = !!((process.env.NEXT_PUBLIC_GA_ID ?? "").trim() || (process.env.NEXT_PUBLIC_META_PIXEL ?? "").trim());

export function ConsentementDiffere() {
  return POSEE ? <Consentement /> : null;
}
