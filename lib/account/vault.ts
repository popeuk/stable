"use client";

import type { StateStorage } from "zustand/middleware";
import { getSession, LOCALE_SCOPE, scopedKey } from "@/lib/account/session";

/**
 * Le coffre de l'appareil : le stockage des données de gestion, rangé par
 * compte et chiffré (AES-GCM 256) avec la clé du compte connecté. Sans
 * session, rien ne se lit. La démo reste en clair : elle ne contient rien
 * de personnel. L'écurie essayée sans compte aussi : il n'y a pas encore de
 * clé, et elle passe chiffrée dans le compte dès qu'on la garde.
 *
 * Les écritures d'un même tiroir passent l'une après l'autre, pour que la
 * plus récente gagne toujours.
 */
const PREFIX = "bs-enc1:";
const fresh = new Set<string>();
const queue = new Map<string, Promise<void>>();
let keyCache: { b64: string; key: CryptoKey } | null = null;

const b64 = {
  to: (buf: ArrayBuffer | Uint8Array) => {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  },
  from: (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

async function accountKey(): Promise<CryptoKey | null> {
  const s = getSession();
  if (s?.kind !== "compte" || !s.dataKey) return null;
  if (keyCache?.b64 === s.dataKey) return keyCache.key;
  const key = await crypto.subtle.importKey("raw", b64.from(s.dataKey), "AES-GCM", false, ["encrypt", "decrypt"]);
  keyCache = { b64: s.dataKey, key };
  return key;
}

async function seal(plain: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return `${PREFIX}${b64.to(iv)}.${b64.to(ct)}`;
}

async function open(sealed: string, key: CryptoKey): Promise<string> {
  const [iv, ct] = sealed.slice(PREFIX.length).split(".");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64.from(iv) }, key, b64.from(ct));
  return new TextDecoder().decode(pt);
}

/** Ce tiroir était-il vide à l'ouverture ? (un nouveau compte démarre à zéro) */
export function wasFresh(name: string) {
  return fresh.has(name);
}

export const vault: StateStorage = {
  async getItem(name) {
    const s = getSession();
    if (!s) return null;
    const raw = localStorage.getItem(scopedKey(name, s));
    if (raw === null) {
      fresh.add(name);
      return null;
    }
    if (!raw.startsWith(PREFIX)) return raw;
    const key = await accountKey();
    if (!key) return null;
    try {
      return await open(raw, key);
    } catch {
      // Clé différente (autre compte, données abîmées) : on ne lit rien.
      return null;
    }
  },
  setItem(name, value) {
    const s = getSession();
    if (!s) return;
    const k = scopedKey(name, s);
    const run = async () => {
      const key = s.kind === "compte" ? await accountKey() : null;
      if (s.kind === "compte" && !key) return;
      localStorage.setItem(k, key ? await seal(value, key) : value);
    };
    const next = (queue.get(k) ?? Promise.resolve()).then(run, run);
    queue.set(k, next);
    return next;
  },
  removeItem(name) {
    localStorage.removeItem(scopedKey(name));
  },
};

/**
 * Rattache au compte les données d'avant les comptes (un seul appareil, un
 * seul gérant) : elles sont chiffrées dans son tiroir puis effacées en clair.
 */
export async function adoptLegacy(): Promise<boolean> {
  const s = getSession();
  if (s?.kind !== "compte") return false;
  const key = await accountKey();
  if (!key) return false;
  let done = false;
  for (const name of ["be-stable-data", "be-stable-settings"]) {
    const raw = localStorage.getItem(name);
    if (raw === null) continue;
    localStorage.setItem(scopedKey(name, s), await seal(raw, key));
    localStorage.removeItem(name);
    done = true;
  }
  return done;
}

/* ---------- Garder ses chiffres : l'écurie essayée passe dans le compte ---------- */

const NAMES = ["be-stable-data", "be-stable-settings"] as const;
const localKey = (name: string) => `${name}@${LOCALE_SCOPE}`;

interface Persisted {
  state?: Record<string, unknown>;
  version?: number;
}
const parse = (raw: string | null): Persisted | null => {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Persisted;
    return p && typeof p === "object" ? p : null;
  } catch {
    return null;
  }
};

/**
 * Les réglages qui passent dans le compte. Compte vide : ceux de l'essai,
 * avec le nom de la fiche et le prénom du compte s'ils manquaient. Compte
 * qui a déjà ses réglages : on les garde, on ajoute seulement les étapes
 * du parcours déjà passées pendant l'essai.
 */
export function mergeLocaleSettings(localRaw: string | null, accountRaw: string | null, id: { stableName?: string; gerant?: string } = {}): string | null {
  const loc = parse(localRaw);
  const acc = parse(accountRaw);
  if (acc?.state) {
    const lp = (loc?.state?.parcours ?? {}) as Record<string, boolean>;
    const ap = (acc.state.parcours ?? {}) as Record<string, boolean>;
    const parcours = { ...ap };
    for (const [k, v] of Object.entries(lp)) if (v) parcours[k] = true;
    return JSON.stringify({ ...acc, state: { ...acc.state, parcours } });
  }
  if (!loc?.state) return accountRaw ?? localRaw;
  const st = { ...loc.state };
  const nom = typeof st.stableName === "string" ? st.stableName.trim() : "";
  if ((!nom || nom === "Mon écurie") && id.stableName) st.stableName = id.stableName;
  if (!(typeof st.gerant === "string" && st.gerant.trim()) && id.gerant) st.gerant = id.gerant;
  return JSON.stringify({ ...loc, state: st });
}

/** Ce que l'écurie essayée contient, pour l'écran « On garde tout pour demain. » */
export interface ResumeEssai {
  chevaux: number;
  pension: number;
  frais: number;
  seances: number;
}
export function resumeEssai(dataRaw: string | null): ResumeEssai | null {
  const st = parse(dataRaw)?.state;
  if (!st) return null;
  const horses = ((st.horses ?? []) as { isArchived?: boolean; pension?: number }[]).filter((h) => !h.isArchived);
  const pensions = horses.map((h) => h.pension ?? 0).filter((p) => p > 0);
  // La pension la plus courante (l'essai la met la même pour tous).
  const freq = new Map<number, number>();
  for (const p of pensions) freq.set(p, (freq.get(p) ?? 0) + 1);
  const pension = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0;
  const frais = ((st.recurringExpenses ?? []) as { isShared?: boolean; amount?: number; endDate?: string | null }[])
    .filter((r) => r.isShared && !r.endDate)
    .reduce((t, r) => t + (r.amount ?? 0), 0);
  const seances = ((st.seances ?? []) as unknown[]).length + ((st.careEvents ?? []) as unknown[]).length;
  return { chevaux: horses.length, pension, frais, seances };
}

/** Le résumé de l'écurie essayée qui attend sur cet appareil. */
export function resumeLocale(): ResumeEssai | null {
  try {
    return resumeEssai(localStorage.getItem(localKey("be-stable-data")));
  } catch {
    return null;
  }
}

/**
 * Juste après le code : l'écurie essayée sans compte passe dans le tiroir
 * chiffré du compte (« locale »), ou on garde ce que le compte avait déjà
 * (« compte »). Dans les deux cas, le tiroir de l'essai est ensuite vidé.
 * Rend false si rien n'a été fait (pas de compte, pas de clé).
 */
export async function adoptLocale(keep: "locale" | "compte" = "locale"): Promise<boolean> {
  const s = getSession();
  if (s?.kind !== "compte") return false;
  const key = await accountKey();
  if (!key) return false;
  if (keep === "locale") {
    const data = localStorage.getItem(localKey("be-stable-data"));
    if (data !== null) localStorage.setItem(scopedKey("be-stable-data", s), await seal(data, key));
    const accSealed = localStorage.getItem(scopedKey("be-stable-settings", s));
    let accRaw: string | null = null;
    if (accSealed !== null) {
      try {
        accRaw = accSealed.startsWith(PREFIX) ? await open(accSealed, key) : accSealed;
      } catch {
        accRaw = null;
      }
    }
    const merged = mergeLocaleSettings(localStorage.getItem(localKey("be-stable-settings")), accRaw, { stableName: s.listing?.title, gerant: s.prenom });
    if (merged !== null) localStorage.setItem(scopedKey("be-stable-settings", s), await seal(merged, key));
  }
  for (const name of NAMES) localStorage.removeItem(localKey(name));
  return true;
}
