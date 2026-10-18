"use client";

import { getSession, type Listing } from "@/lib/account/session";

/**
 * Ce que Be Stable demande à mon-ecurie.fr : les comptes (inscription,
 * connexion, mot de passe) et la fiche de l'écurie (chercher, revendiquer,
 * créer, compléter). Tout passe par l'API « bestable/v1 » du site.
 * Rien de la gestion (chevaux, argent, planning) ne part d'ici.
 */
export const API = (process.env.NEXT_PUBLIC_MONECURIE_API ?? "https://www.mon-ecurie.fr/wp-json/bestable/v1").replace(/\/$/, "");

/** L'adresse de l'app, pour le lien de l'e-mail « mot de passe oublié ». */
export const appUrl = (path: string) => `${typeof window !== "undefined" ? window.location.origin : ""}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** WordPress rend parfois les titres en entités (« d&rsquo;Elwing ») : on les décode. */
function plain(s: unknown): unknown {
  if (typeof s !== "string" || !s.includes("&")) return s;
  const t = document.createElement("textarea");
  t.innerHTML = s;
  return t.value;
}
function clean<T>(v: T): T {
  if (Array.isArray(v)) return v.map(clean) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ["title", "commune", "description", "nom", "structure_nom"].includes(k) ? plain(x) : clean(x)])) as T;
  return v;
}

const SLOW = "mon-ecurie.fr met trop de temps à répondre. Réessaie dans quelques minutes.";
const OFFLINE = "Impossible de joindre mon-ecurie.fr. Vérifiez votre connexion et réessayez.";

export interface Demande {
  fonction?: string;
  telephone?: string;
  siret?: string;
  raison?: string;
  message?: string;
  fiche: Partial<Fiche>;
}

async function call<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  const s = getSession();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (s?.kind === "compte") headers["X-BS-Token"] = s.token;
  let res: Response;
  // L'hébergeur refuse parfois une rafale de lectures (429) : on relit deux fois, sans bruit.
  for (let essai = 0; ; essai++) {
    // Au-delà de 25 s, on rend la main avec un message clair plutôt que « injoignable ».
    const stop = new AbortController();
    const minuteur = setTimeout(() => stop.abort(), 25000);
    try {
      res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: "omit", signal: stop.signal });
    } catch {
      throw stop.signal.aborted ? new ApiError("trop_long", SLOW) : new ApiError("hors_ligne", OFFLINE);
    } finally {
      clearTimeout(minuteur);
    }
    if (res.status !== 429 || method !== "GET" || essai >= 2) break;
    await new Promise((r) => setTimeout(r, 1200 * (essai + 1)));
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {}
  if (!res.ok) {
    const j = (json ?? {}) as { code?: string; message?: string; data?: Record<string, unknown> };
    throw new ApiError(j.code ?? "erreur", j.message ?? "Une erreur est survenue. Réessayez dans un instant.", res.status, j.data ?? {});
  }
  return clean(json) as T;
}

export interface Me {
  id: number;
  email: string;
  prenom: string;
  nom?: string;
  telephone?: string;
}

export interface AuthResponse {
  token: string;
  data_key: string;
  user: Me;
  listing: Listing | null;
}

export interface StableHit {
  id: number;
  title: string;
  commune?: string;
  code_postal?: string;
  departement?: string;
  statut: "libre" | "en_verification" | "revendiquee";
  url?: string;
  image?: string;
  univers?: string[];
  remplissage: number;
}

export interface Formule {
  nom: string;
  description: string;
  prix: string;
  /** "" = non précisé, "0" = complet. */
  places: string;
}

/** Les champs publics d'une fiche, tels que le gérant les remplit. */
export interface Fiche {
  id?: number;
  title: string;
  description: string;
  adresse: string;
  code_postal: string;
  commune: string;
  departement?: string;
  telephone: string;
  email: string;
  site: string;
  offres: string[];
  hebergement: string[];
  installations: string[];
  services: string[];
  prix_min: string;
  /** "" = non précisé, "0" = complet. */
  places_libres: string;
  places_maj?: string;
  formules: Formule[];
  photos: { id: number; url: string }[];
  url?: string;
  statut?: StableHit["statut"];
  remplissage?: number;
  manque?: string[];
  en_attente?: boolean;
}

export type Choix = Record<"offres" | "hebergement" | "installations" | "services" | "univers", Record<string, string>>;

export const PW_MIN = 10;

export const api = {
  inscription: (p: { prenom: string; nom: string; email: string; telephone: string; password: string; site: string }) => call<AuthResponse>("POST", "/inscription", p),
  connexion: (p: { email: string; password: string }) => call<AuthResponse>("POST", "/connexion", p),
  deconnexion: () => call<{ ok: true }>("POST", "/deconnexion", {}),
  envoyerCode: (email: string) => call<{ ok: true; compte?: boolean }>("POST", "/code/envoyer", { email }),
  verifierCode: (email: string, code: string) => call<AuthResponse & { nouveau: boolean }>("POST", "/code/verifier", { email, code }),
  /** Google ou Apple : le jeton signé de Supabase ouvre le compte de cette adresse (lib/account/oauth). */
  connexionSupabase: (accessToken: string) => call<AuthResponse & { nouveau: boolean }>("POST", "/connexion/supabase", { access_token: accessToken }),
  majMoi: (p: { prenom?: string; nom?: string; telephone?: string; ecurie?: string; projet?: boolean }) => call<{ user: Me }>("PUT", "/moi", p),
  oubli: (email: string) => call<{ ok: true }>("POST", "/mot-de-passe/oubli", { email, retour: appUrl("/compte/nouveau-mot-de-passe/") }),
  nouveau: (p: { login: string; key: string; password: string }) => call<AuthResponse>("POST", "/mot-de-passe/nouveau", p),
  moi: () => call<{ user: Me; listing: Listing | null; data_key: string }>("GET", "/moi"),
  chercher: (q: string, dep = "") => call<{ resultats: StableHit[]; total: number }>("GET", `/ecuries?q=${encodeURIComponent(q)}&dep=${encodeURIComponent(dep)}`),
  ecurie: (id: number) => call<Fiche>("GET", `/ecuries/${id}`),
  revendiquer: (id: number, p: Demande) => call<{ listing: Listing }>("POST", `/ecuries/${id}/revendiquer`, p),
  creer: (p: Demande & { univers: string }) => call<{ listing: Listing }>("POST", "/ecuries", p),
  choix: () => call<Choix>("GET", "/choix"),
  photo: async (file: File) => {
    const s = getSession();
    const fd = new FormData();
    fd.append("photo", file);
    let res: Response;
    try {
      res = await fetch(`${API}/ma-fiche/photos`, { method: "POST", body: fd, headers: s?.kind === "compte" ? { "X-BS-Token": s.token } : {}, credentials: "omit" });
    } catch {
      throw new ApiError("hors_ligne", OFFLINE);
    }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(j.code ?? "erreur", j.message ?? "La photo n’a pas pu être envoyée.", res.status);
    return j as Fiche;
  },
  retirerPhoto: (id: number) => call<Fiche>("DELETE", `/ma-fiche/photos/${id}`),
  maFiche: () => call<Fiche>("GET", "/ma-fiche"),
  majFiche: (f: Partial<Fiche>) => call<Fiche>("PUT", "/ma-fiche", f),
  stats: () => call<{ ecuries: number; departements: number; revendiquees: number; avec_prix: number }>("GET", "/chiffres"),
};
