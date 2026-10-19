// La fonction « tiroirs » : la seule porte vers la copie des données de
// gestion. Le compte est celui de mon-ecurie.fr : on vérifie son jeton
// (X-BS-Token) auprès du site, puis on ne touche qu'aux tiroirs de ce compte.
// Le contenu arrive déjà chiffré par l'app ; il n'est jamais lu ici.
//
//   GET                → { tiroirs: [{ nom, rev, contenu, modifie }], formats }
//                        (formats : les préfixes acceptés, « bs-enc1: » et « bs-enc2: »)
//   PUT  { nom, contenu, rev, modifie, appareil }
//                      → 200 { rev } si `rev` est la version connue du serveur
//                        (0 = pas encore de copie), sinon 409 { tiroir }
//   POST { nom, contenu, rev, modifie, appareil, garder: true }
//                      → garde une copie perdante d'un conflit dans les versions
//                        (on en garde 30 par tiroir, comme pour les remplacées)
//
// Garde-fous (audit du 18 octobre, I6, M1, F4) : 2 Mo au plus par envoi,
// contenu chiffré seulement (« bs-enc1: », ou « bs-enc2: » compressé puis chiffré), 6 envois par minute et par compte,
// jeton au bon format avant tout appel au site, refus gardés 5 minutes,
// jetons bons gardés 2 minutes, appels au site limités par adresse IP.
// Les compteurs vivent dans la mémoire de l'instance : ils freinent un abus,
// ils ne sont pas exacts à l'unité quand Supabase lance plusieurs instances.
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { CACHE_OK_MS, CACHE_REFUS_MS, FORMATS, Fenetre, MAX, Memoire, VERSIONS, contenuChiffre, jetonBienForme, versionsEnTrop } from "./regles.ts";

const MONECURIE = (Deno.env.get("MONECURIE_API") ?? "https://www.mon-ecurie.fr/wp-json/bestable/v1").replace(/\/$/, "");
const NOMS = new Set(["be-stable-data", "be-stable-settings"]);
const ORIGINES = [/^https:\/\/popeuk\.github\.io$/, /^https:\/\/([a-z0-9-]+\.)?bestable\.fr$/, /^https:\/\/app\.187-7-74-179\.sslip\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

/** Jetons déjà vérifiés (2 minutes) et jetons refusés (5 minutes), dans cette instance. */
const connus = new Memoire<number>(CACHE_OK_MS);
const refuses = new Memoire<true>(CACHE_REFUS_MS);
/** Envois (PUT, POST) : 6 par minute et par compte. */
const envois = new Fenetre(6, 60_000);
/** Vérifications auprès du site : 30 par minute et par adresse IP. */
const verifs = new Fenetre(30, 60_000);

function ip(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "?";
}

function entetes(req: Request): Record<string, string> {
  const o = req.headers.get("Origin") ?? "";
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-BS-Token",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  if (ORIGINES.some((r) => r.test(o))) h["Access-Control-Allow-Origin"] = o;
  return h;
}

async function compte(token: string, adresse: string): Promise<number | "refuse" | "injoignable" | "trop"> {
  if (!jetonBienForme(token) || refuses.lire(token)) return "refuse";
  const c = connus.lire(token);
  if (c) return c;
  if (verifs.depasse(adresse)) return "trop";
  const stop = new AbortController();
  const t = setTimeout(() => stop.abort(), 15000);
  try {
    const r = await fetch(`${MONECURIE}/moi`, { headers: { Accept: "application/json", "X-BS-Token": token }, signal: stop.signal });
    if (r.status === 401 || r.status === 403) {
      refuses.poser(token, true);
      return "refuse";
    }
    if (!r.ok) return "injoignable";
    const j = (await r.json()) as { user?: { id?: unknown } };
    const id = Number(j?.user?.id);
    if (!Number.isInteger(id) || id <= 0) return "injoignable";
    // Le numéro du jeton doit être celui du compte rendu par le site.
    if (token.split(".")[0] !== String(id)) return "refuse";
    connus.poser(token, id);
    return id;
  } catch {
    return "injoignable";
  } finally {
    clearTimeout(t);
  }
}

interface Envoi {
  nom?: unknown;
  contenu?: unknown;
  rev?: unknown;
  modifie?: unknown;
  appareil?: unknown;
  garder?: unknown;
}

Deno.serve(async (req) => {
  const h = entetes(req);
  const rep = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: h });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });

  const token = req.headers.get("X-BS-Token") ?? "";
  if (!token || token.length > 512) return rep(401, { code: "session_expiree", message: "Connexion nécessaire." });
  const userId = await compte(token, ip(req));
  if (userId === "trop") return rep(429, { code: "trop_d_essais", message: "Trop d’essais. Réessaie dans une minute." });
  if (userId === "refuse") return rep(401, { code: "session_expiree", message: "Connexion nécessaire." });
  if (userId === "injoignable") return rep(503, { code: "monecurie_injoignable", message: "bestable.fr ne répond pas." });

  if (req.method === "GET") {
    const { data, error } = await db.from("tiroirs").select("nom, rev, contenu, modifie").eq("user_id", userId);
    if (error) return rep(500, { code: "erreur", message: "Lecture impossible." });
    return rep(200, { tiroirs: data ?? [], formats: FORMATS });
  }

  if (req.method !== "PUT" && req.method !== "POST") return rep(405, { code: "methode" });
  if (Number(req.headers.get("Content-Length") ?? 0) > MAX + 10_000) return rep(413, { code: "trop_gros" });
  if (envois.depasse(String(userId))) return rep(429, { code: "trop_d_envois", message: "Trop d’envois. La copie repart dans une minute." });
  let b: Envoi;
  try {
    b = (await req.json()) as Envoi;
  } catch {
    return rep(400, { code: "json" });
  }
  const nom = String(b.nom ?? "");
  const contenu = typeof b.contenu === "string" ? b.contenu : "";
  const rev = Number(b.rev);
  const modifie = typeof b.modifie === "string" && !Number.isNaN(Date.parse(b.modifie)) ? b.modifie : new Date().toISOString();
  const appareil = typeof b.appareil === "string" ? b.appareil.slice(0, 80) : null;
  if (contenu.length > MAX) return rep(413, { code: "trop_gros" });
  if (!NOMS.has(nom) || !contenuChiffre(contenu) || !Number.isInteger(rev) || rev < 0) return rep(400, { code: "invalide" });

  if (req.method === "POST") {
    if (b.garder !== true) return rep(400, { code: "invalide" });
    const { error } = await db.from("tiroirs_versions").insert({ user_id: userId, nom, rev: rev || null, contenu, modifie, appareil, raison: "conflit" });
    if (error) return rep(500, { code: "erreur" });
    // Le ménage, comme après une mise à jour : les 30 versions les plus récentes du tiroir.
    const { data: toutes } = await db
      .from("tiroirs_versions")
      .select("id")
      .eq("user_id", userId)
      .eq("nom", nom)
      .order("gardee_le", { ascending: false })
      .order("id", { ascending: false })
      .limit(VERSIONS + 200);
    const enTrop = versionsEnTrop((toutes ?? []) as { id: number }[]);
    if (enTrop.length) await db.from("tiroirs_versions").delete().eq("user_id", userId).in("id", enTrop);
    return rep(200, { ok: true });
  }

  const ligne = { contenu, modifie, appareil, rev: rev + 1, maj: new Date().toISOString() };
  const { data, error } =
    rev === 0
      ? await db.from("tiroirs").insert({ user_id: userId, nom, ...ligne }).select("rev")
      : await db.from("tiroirs").update(ligne).eq("user_id", userId).eq("nom", nom).eq("rev", rev).select("rev");
  if (error && error.code !== "23505") return rep(500, { code: "erreur" });
  if (!error && data?.length) return rep(200, { rev: data[0].rev });

  // Le serveur a une autre version : on la rend, l'app choisit.
  const { data: actuel } = await db.from("tiroirs").select("nom, rev, contenu, modifie").eq("user_id", userId).eq("nom", nom).maybeSingle();
  return rep(409, { code: "conflit", tiroir: actuel });
});
