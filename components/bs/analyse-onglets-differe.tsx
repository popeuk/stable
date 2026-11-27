"use client";

import dynamic from "next/dynamic";

/** L'en-tête de l'Analyse ne sert que sur ses trois pages : chargé à part, il ne pèse pas sur l'Accueil (230 Ko). */
export const AnalyseOnglets = dynamic(() => import("@/components/bs/analyse-onglets").then((m) => m.AnalyseOnglets), { ssr: false });
export const VitrineOnglets = dynamic(() => import("@/components/bs/analyse-onglets").then((m) => m.VitrineOnglets), { ssr: false });
