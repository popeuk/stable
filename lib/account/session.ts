"use client";

/**
 * La session du gérant sur cet appareil.
 *
 * Un compte Be Stable est un compte mon-ecurie.fr : mon-ecurie.fr garde les
 * identifiants et la fiche, Be Stable garde la gestion (chevaux, argent,
 * planning) sur l'appareil, chiffrée avec la clé du compte.
 *
 * Quatre états : aucune session (on montre l'accueil), la démo (l'écurie
 * d'exemple, sans serveur), l'écurie locale (ses propres chiffres, sur cet
 * appareil, sans compte : on essaie avant de s'inscrire), un compte connecté. Un seul compte est ouvert à la
 * fois : se connecter à un autre ferme le premier et efface sa clé.
 */
export type ListingStatus = "aucune" | "revendication_en_attente" | "creation_en_attente" | "validee" | "refusee";

export interface Listing {
  id: number;
  title: string;
  commune?: string;
  departement?: string;
  url?: string;
  status: ListingStatus;
}

export interface AccountSession {
  kind: "compte";
  userId: number;
  email: string;
  prenom: string;
  nom?: string;
  telephone?: string;
  token: string;
  /** Clé de chiffrement des données de gestion, propre au compte (base64). */
  dataKey: string;
  listing?: Listing | null;
  at: string;
}

export interface DemoSession {
  kind: "demo";
}

/**
 * L'écurie essayée avant le compte : les chiffres du gérant, sur cet appareil
 * seulement, en clair comme la démo. « Garder mes chiffres » la fait passer
 * dans un compte (lib/account/vault : adoptLocale).
 */
export interface LocaleSession {
  kind: "locale";
  at: string;
}

export type Session = AccountSession | DemoSession | LocaleSession;

/** Le tiroir de l'écurie essayée sans compte. */
export const LOCALE_SCOPE = "locale";

const KEY = "be-stable-session";

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(s: Session) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function updateAccount(patch: Partial<Omit<AccountSession, "kind">>) {
  const s = getSession();
  if (s?.kind !== "compte") return;
  setSession({ ...s, ...patch });
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

/** Le préfixe de rangement des données : un tiroir par compte, un pour la démo, un pour l'écurie essayée sans compte. */
export function scopeOf(s: Session | null = getSession()): string | null {
  if (!s) return null;
  if (s.kind === "demo") return "demo";
  if (s.kind === "locale") return LOCALE_SCOPE;
  return `u${s.userId}`;
}

/** Une écurie essayée sans compte attend-elle sur cet appareil ? */
export function hasLocaleData(): boolean {
  try {
    return !!localStorage.getItem(`be-stable-data@${LOCALE_SCOPE}`);
  } catch {
    return false;
  }
}

export function scopedKey(name: string, s: Session | null = getSession()): string {
  const scope = scopeOf(s);
  return scope ? `${name}@${scope}` : name;
}

/** Des données d'avant les comptes existent-elles sur cet appareil ? */
export function hasLegacyData(): boolean {
  try {
    return !!localStorage.getItem("be-stable-data");
  } catch {
    return false;
  }
}

/** Ce compte a-t-il déjà ses données sur cet appareil ? */
export function hasAccountData(userId: number): boolean {
  try {
    return !!localStorage.getItem(`be-stable-data@u${userId}`);
  } catch {
    return false;
  }
}

/**
 * Ouvre une session puis recharge l'app : les données du compte se
 * chargent proprement, sans jamais croiser celles d'un autre tiroir.
 */
export function enter(s: Session, to = "/accueil") {
  setSession(s);
  window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${to}`);
}

export function leave(to = "/bienvenue") {
  clearSession();
  window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${to}`);
}

/** Une réponse d'authentification de mon-ecurie.fr devient une session. */
export function sessionFrom(r: { token: string; data_key: string; user: { id: number; email: string; prenom: string; nom?: string; telephone?: string }; listing: Listing | null }): AccountSession {
  return {
    kind: "compte",
    userId: r.user.id,
    email: r.user.email,
    prenom: r.user.prenom,
    nom: r.user.nom,
    telephone: r.user.telephone,
    token: r.token,
    dataKey: r.data_key,
    listing: r.listing,
    at: new Date().toISOString(),
  };
}
