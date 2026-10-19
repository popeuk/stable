"use client";

import { getSession, scopedKey } from "@/lib/account/session";
import { ecrituresFaites, relireTiroir } from "@/lib/account/vault";
import { noterEcriture, TIROIRS } from "@/lib/account/nuage";
import { estPlacePleine, noterPlacePleine } from "@/lib/account/place";

/**
 * « Effacer mon écurie partout », récupérable 7 jours. Juste avant
 * d'effacer, l'écurie telle qu'elle est rangée (déjà chiffrée avec la clé du
 * compte) est mise de côté sur cet appareil, avec la date. Pendant 7 jours,
 * Réglages propose « Récupérer l'écurie d'avant » : elle revient ici, puis
 * repart dans la copie en ligne et sur les autres appareils.
 *
 * La copie en ligne garde aussi les 30 versions précédentes de chaque tiroir
 * (supabase/migrations/0003_tiroirs.sql), mais la fonction « tiroirs » ne
 * sait pas encore les relire : depuis un autre appareil, la récupération
 * passe par le support (docs/recuperer-une-ecurie.md).
 */
export const JOURS_RECUPERATION = 7;
const NOM = "bs-avant-effacement";

interface MisDeCote {
  /** Quand l'écurie a été effacée (ISO). */
  quand: string;
  /** Les tiroirs tels qu'ils étaient rangés (chiffrés). */
  tiroirs: Record<string, string>;
}

function lire(): MisDeCote | null {
  try {
    const raw = localStorage.getItem(scopedKey(NOM));
    const m = raw ? (JSON.parse(raw) as MisDeCote) : null;
    return m && typeof m.quand === "string" && m.tiroirs && typeof m.tiroirs === "object" ? m : null;
  } catch {
    return null;
  }
}

/** Encore récupérable ? (moins de 7 jours) */
export function encoreRecuperable(quand: string, maintenant = Date.now()): boolean {
  const t = Date.parse(quand);
  return Number.isFinite(t) && maintenant - t < JOURS_RECUPERATION * 86_400_000 && maintenant >= t - 60_000;
}

/** L'écurie effacée qu'on peut encore récupérer sur cet appareil, avec sa date ; sinon rien (et la copie trop vieille s'en va). */
export function ecurieEffacee(maintenant = Date.now()): { quand: string } | null {
  if (getSession()?.kind !== "compte") return null;
  const m = lire();
  if (!m) return null;
  if (!encoreRecuperable(m.quand, maintenant)) {
    oublier();
    return null;
  }
  return { quand: m.quand };
}

function oublier() {
  try {
    localStorage.removeItem(scopedKey(NOM));
  } catch {}
}

/**
 * Met l'écurie de côté juste avant de l'effacer. Rend false si rien n'a pu
 * être gardé (pas de compte, ou plus de place sur l'appareil) : la copie en
 * ligne garde quand même ses versions.
 */
export async function mettreDeCote(maintenant = new Date()): Promise<boolean> {
  if (getSession()?.kind !== "compte") return false;
  const tiroirs: Record<string, string> = {};
  for (const nom of TIROIRS) {
    await ecrituresFaites(nom);
    const raw = localStorage.getItem(scopedKey(nom));
    if (raw) tiroirs[nom] = raw;
  }
  if (!Object.keys(tiroirs).length) return false;
  try {
    localStorage.setItem(scopedKey(NOM), JSON.stringify({ quand: maintenant.toISOString(), tiroirs } satisfies MisDeCote));
    return true;
  } catch {
    return false;
  }
}

/**
 * Remet l'écurie d'avant sur cet appareil et la marque à envoyer : au
 * rechargement, elle repart dans la copie en ligne. Rend false si elle n'est
 * plus là, ou si la place manque (rien n'est alors changé, la copie reste).
 * L'appelant recharge l'app tout de suite après.
 */
export async function recupererEcurie(): Promise<boolean> {
  if (getSession()?.kind !== "compte") return false;
  const m = lire();
  if (!m || !encoreRecuperable(m.quand)) return false;
  for (const nom of TIROIRS) await ecrituresFaites(nom);
  // Faute de place, on remet ce qui était là avant : jamais une récupération à moitié faite.
  const avant = new Map<string, string | null>();
  const remis: string[] = [];
  try {
    for (const [nom, raw] of Object.entries(m.tiroirs)) {
      if (!(TIROIRS as readonly string[]).includes(nom)) continue;
      avant.set(nom, localStorage.getItem(scopedKey(nom)));
      localStorage.setItem(scopedKey(nom), raw);
      remis.push(nom);
    }
  } catch (err) {
    if (estPlacePleine(err)) noterPlacePleine();
    for (const [nom, v] of avant) {
      try {
        if (v === null) localStorage.removeItem(scopedKey(nom));
        else localStorage.setItem(scopedKey(nom), v);
      } catch {}
    }
    return false;
  }
  for (const nom of remis) {
    const clair = await relireTiroir(nom);
    if (clair !== null) await noterEcriture(nom, clair);
  }
  oublier();
  return true;
}
