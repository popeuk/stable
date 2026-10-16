"use client";

import { useSyncExternalStore } from "react";

/**
 * Le personnage de l'app : gérante ou gérant, tiré une fois par appareil et
 * gardé. Toutes les illustrations du personnage passent par ici (Ill le fait
 * tout seul) : on ne voit jamais l'un puis l'autre dans le même écran.
 */
export type Perso = "f" | "m";
const TIRAGE = "be-stable-tirage";

let memo: Perso | null = null;
function tirer(): Perso {
  if (memo) return memo;
  let v: Perso = "f";
  try {
    const raw = localStorage.getItem(TIRAGE);
    if (raw === "f" || raw === "m") v = raw;
    else {
      v = Math.random() < 0.5 ? "f" : "m";
      localStorage.setItem(TIRAGE, v);
    }
  } catch {
    v = new Date().getDate() % 2 ? "m" : "f";
  }
  memo = v;
  return v;
}

const rien = () => () => {};
/** Gérante (« f ») ou gérant (« m ») : le même à chaque visite sur cet appareil. */
export function usePerso(): Perso {
  return useSyncExternalStore(rien, tirer, () => "f");
}

/**
 * Les images du personnage. À gauche la gérante, à droite le gérant. Quand
 * la version gérant n'existe pas encore (brouette, carnet, matin, soir,
 * sereine), Ill retombe sur la gérante.
 */
const PAIRES: [string, string][] = [
  ["assise", "gerant-assise"],
  ["foin", "gerant-foin"],
  ["rosette", "gerant-rosette"],
  ["carnet-buste", "gerant-buste"],
  ["brouette", "gerant-brouette"],
  ["carnet", "gerant-carnet"],
  ["matin", "gerant-matin"],
  ["soir", "gerant-soir"],
  ["sereine", "gerant-sereine"],
];
const VERS_M = new Map(PAIRES);
const VERS_F = new Map(PAIRES.map(([f, m]) => [m, f]));

/** Le nom d'image pour ce personnage, et la version gérante de secours. */
export function illPerso(n: string, p: Perso): { n: string; repli?: string } {
  const f = VERS_F.get(n) ?? n;
  if (p === "f") return { n: f };
  const m = VERS_M.get(f);
  return m ? { n: m, repli: f } : { n };
}

/** Le texte de remplacement accordé au personnage (« La gérante, assise » devient « Le gérant, assis »). */
export function altPerso(alt: string, p: Perso): string {
  if (!alt) return alt;
  if (p === "f")
    return alt
      .replace(/\bLe gérant\b/g, "La gérante")
      .replace(/\bUn gérant\b/g, "Une gérante")
      .replace(/\ble gérant\b/g, "la gérante")
      .replace(/\bun gérant\b/g, "une gérante")
      .replace(/\bassis\b/g, "assise");
  return alt
    .replace(/\bLa gérante\b/g, "Le gérant")
    .replace(/\bUne gérante\b/g, "Un gérant")
    .replace(/\bla gérante\b/g, "le gérant")
    .replace(/\bune gérante\b/g, "un gérant")
    .replace(/\bassise\b/g, "assis")
    .replace(/\bfatiguée\b/g, "fatigué");
}
