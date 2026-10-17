"use client";

import type { ReactNode } from "react";

/* ---------- Format ---------- */
/* Espace insécable ordinaire : la fine (U+202F) ne s’affiche pas dans nos polices. */
const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf = { format: (n: number) => nf0.format(n).replace(/\u202f/g, "\u00a0") };
/** À l'euro, symétrique : 500,5 donne 501 et −500,5 donne −501 (le même chiffre, rentré ou sorti). */
const arrondi = (n: number) => Math.sign(n) * Math.round(Math.abs(n)) || 0;
export const eur = (n: number) => `${nf.format(arrondi(n))} €`;
export const signed = (n: number) => {
  const r = arrondi(n);
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${nf.format(Math.abs(r))} €`;
};
export const dec1 = (n: number) => (isFinite(n) ? n.toFixed(1).replace(".", ",") : "∞");
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export { esc } from "@/lib/utils/esc";

/** Un lien brut (dans un message HTML) doit porter le préfixe de déploiement. */
export const withBase = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;

/* ---------- Haut d'écran ---------- */
/**
 * Un écran. Sur ordinateur, « wide » occupe toute la largeur utile
 * (cockpit, planning, tableaux) ; sinon une colonne de lecture.
 */
export function Screen({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className={`cn-page bs-screen${wide ? " wide" : ""}`}>{children}</div>;
}

/** « Il en faut 8. » : un demi-cheval ne se loge pas, on arrondit au-dessus, sans montrer la décimale. */
export const ilEnFaut = (seuil: number) => {
  const n = Math.ceil(seuil - 1e-9);
  return `Il en faut ${n}.`;
};
