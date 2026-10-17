"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/account/api";

/**
 * Entrer avec Google (puis Apple), par Supabase Auth.
 *
 * 1. `partirVers` : l'app part chez Google, qui revient sur l'écran de
 *    connexion avec un code (?code=…, échange PKCE).
 * 2. `revenirDe` : l'app échange ce code contre le jeton signé de Supabase,
 *    puis oublie aussitôt la session Supabase.
 * 3. Ce jeton va à mon-ecurie.fr (`api.connexionSupabase`), qui le vérifie
 *    avec la clé publique de Supabase et ouvre le compte de cette adresse :
 *    le même compte, la même clé de données que le code par e-mail.
 *
 * La clé ci-dessous est publique (« publishable ») : elle ne donne accès à
 * aucune donnée.
 */
const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL ?? "https://wgvithqivsygsoeyqruz.supabase.co";
const CLE_PUBLIQUE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_e6R9yC-WtMe39sWuIWPKRw_vudSuE0o";

export type Fournisseur = "google" | "apple";

/**
 * Les boutons n'apparaissent qu'une fois branchés de bout en bout (Supabase,
 * extension pc-bestable 1.2.0 sur le site) : NEXT_PUBLIC_GOOGLE=1 et
 * NEXT_PUBLIC_APPLE=1 au moment de construire l'app.
 */
export const AVEC_GOOGLE = process.env.NEXT_PUBLIC_GOOGLE === "1";
export const AVEC_APPLE = process.env.NEXT_PUBLIC_APPLE === "1";

let client: SupabaseClient | null = null;
function auth() {
  client ??= createClient(URL_SUPABASE, CLE_PUBLIQUE, {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "bs-oauth" },
  });
  return client.auth;
}

const NOMS: Record<Fournisseur, string> = { google: "Google", apple: "Apple" };

/** Part chez Google ou Apple ; le retour se fait sur `retour` (une adresse de l'app). */
export async function partirVers(f: Fournisseur, retour: string): Promise<void> {
  const { error } = await auth().signInWithOAuth({
    provider: f,
    options: { redirectTo: retour, queryParams: f === "google" ? { prompt: "select_account" } : undefined },
  });
  if (error) throw new ApiError("oauth", `${NOMS[f]} ne répond pas. Réessaie, ou reçois un code par e-mail.`);
}

/** Le retour de Google ou d'Apple est-il dans l'adresse ? Rend le code, l'erreur, ou rien. */
export function lireRetour(search: string): { code?: string; erreur?: string } | null {
  const q = new URLSearchParams(search);
  if (q.get("code")) return { code: q.get("code")! };
  if (q.get("error")) return { erreur: q.get("error_description") || q.get("error")! };
  return null;
}

/** Échange le code du retour contre le jeton signé de Supabase, puis oublie la session Supabase. */
export async function revenirDe(code: string): Promise<string> {
  const { data, error } = await auth().exchangeCodeForSession(code);
  if (error || !data.session) throw new ApiError("oauth", "La connexion n’a pas abouti. Réessaie, ou reçois un code par e-mail.");
  const jeton = data.session.access_token;
  // Seul le compte mon-ecurie.fr compte ensuite : on ne garde rien de Supabase ici.
  await auth().signOut({ scope: "local" }).catch(() => {});
  return jeton;
}
