"use client";

import type { StateStorage } from "zustand/middleware";
import { getSession, scopedKey } from "@/lib/account/session";

/**
 * Le coffre de l'appareil : le stockage des données de gestion, rangé par
 * compte et chiffré (AES-GCM 256) avec la clé du compte connecté. Sans
 * session, rien ne se lit. La démo reste en clair : elle ne contient rien
 * de personnel.
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
