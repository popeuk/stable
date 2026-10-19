"use client";

import { scopedKey } from "@/lib/account/session";
import { relireTiroir } from "@/lib/account/vault";
import { compteurMax } from "@/lib/domain/factures-base";
import { estPlacePleine, noterPlacePleine } from "@/lib/account/place";
import type { Invoice } from "@/lib/domain/types";

/**
 * Les numéros de facture ne reculent jamais et ne reviennent jamais.
 *
 * - Le compteur de l'appareil : le plus grand numéro donné ici, par année,
 *   rangé à part des données (une sauvegarde reprise ne le touche pas). Il
 *   ne contient que des numéros, rien de personnel.
 * - Juste avant de numéroter, on relit le carnet enregistré : un autre onglet
 *   a pu faire une facture entre-temps.
 * - Deux onglets ne numérotent jamais en même temps : un verrou du
 *   navigateur (`navigator.locks`) les fait passer l'un après l'autre.
 *
 * La limite, dite dans Tes factures : deux appareils ne se voient pas tant
 * que l'app ne partage pas les factures.
 */
const NOM = "be-stable-factures";

const propre = (o: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (o && typeof o === "object") for (const [y, n] of Object.entries(o)) if (/^\d{4}$/.test(y) && Number.isInteger(n) && (n as number) > 0) out[y] = n as number;
  return out;
};

/** Le plus grand numéro déjà donné sur cet appareil, par année. */
export function compteurAppareil(): Record<string, number> {
  try {
    const raw = localStorage.getItem(scopedKey(NOM));
    return raw ? propre(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

/** Note les numéros qu'on vient de donner (le compteur ne fait que monter). */
export function noterCompteur(c: Record<string, number>): void {
  try {
    localStorage.setItem(scopedKey(NOM), JSON.stringify(compteurMax(compteurAppareil(), c)));
  } catch (e) {
    if (estPlacePleine(e)) noterPlacePleine();
    // Stockage plein ou fermé : le carnet garde son propre compteur.
  }
}

/** Les factures et le compteur tels qu'ils sont enregistrés à cet instant. */
export async function facturesEnregistrees(): Promise<{ invoices?: Invoice[]; invoiceSeq?: Record<string, number> } | null> {
  try {
    const raw = await relireTiroir("be-stable-data");
    if (!raw) return null;
    const st = (JSON.parse(raw) as { state?: { invoices?: unknown; invoiceSeq?: unknown } })?.state;
    if (!st) return null;
    return { invoices: Array.isArray(st.invoices) ? (st.invoices as Invoice[]) : undefined, invoiceSeq: propre(st.invoiceSeq) };
  } catch {
    return null;
  }
}

/** Un seul onglet à la fois numérote (quand le navigateur sait le faire). */
export async function sousVerrou<T>(f: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (locks?.request) return (await locks.request(NOM, () => f())) as T;
  return f();
}
