// La fonction « tiroirs » : la seule porte vers la copie des données de
// gestion. Le compte est celui de mon-ecurie.fr : on vérifie son jeton
// (X-BS-Token) auprès du site, puis on ne touche qu'aux tiroirs de ce compte.
// Le contenu arrive déjà chiffré par l'app ; il n'est jamais lu ici.
//
//   GET                → { tiroirs: [{ nom, rev, contenu, modifie }] }
//   PUT  { nom, contenu, rev, modifie, appareil }
//                      → 200 { rev } si `rev` est la version connue du serveur
//                        (0 = pas encore de copie), sinon 409 { tiroir }
//   POST { nom, contenu, rev, modifie, appareil, garder: true }
//                      → garde une copie perdante d'un conflit dans les versions
import { createClient } from "npm:@supabase/supabase-js@2.108.2";

const MONECURIE = (Deno.env.get("MONECURIE_API") ?? "https://www.mon-ecurie.fr/wp-json/bestable/v1").replace(/\/$/, "");
const NOMS = new Set(["be-stable-data", "be-stable-settings"]);
const MAX = 5_000_000;
const ORIGINES = [/^https:\/\/popeuk\.github\.io$/, /^https:\/\/([a-z0-9-]+\.)?bestable\.fr$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

/** Jetons déjà vérifiés, gardés 10 minutes dans cette instance. */
const connus = new Map<string, { userId: number; jusqua: number }>();

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

async function compte(token: string): Promise<number | "refuse" | "injoignable"> {
  const c = connus.get(token);
  if (c && c.jusqua > Date.now()) return c.userId;
  const stop = new AbortController();
  const t = setTimeout(() => stop.abort(), 15000);
  try {
    const r = await fetch(`${MONECURIE}/moi`, { headers: { Accept: "application/json", "X-BS-Token": token }, signal: stop.signal });
    if (r.status === 401 || r.status === 403) return "refuse";
    if (!r.ok) return "injoignable";
    const j = (await r.json()) as { user?: { id?: unknown } };
    const id = Number(j?.user?.id);
    if (!Number.isInteger(id) || id <= 0) return "injoignable";
    connus.set(token, { userId: id, jusqua: Date.now() + 10 * 60_000 });
    if (connus.size > 5000) connus.clear();
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
  const userId = await compte(token);
  if (userId === "refuse") return rep(401, { code: "session_expiree", message: "Connexion nécessaire." });
  if (userId === "injoignable") return rep(503, { code: "monecurie_injoignable", message: "mon-ecurie.fr ne répond pas." });

  if (req.method === "GET") {
    const { data, error } = await db.from("tiroirs").select("nom, rev, contenu, modifie").eq("user_id", userId);
    if (error) return rep(500, { code: "erreur", message: "Lecture impossible." });
    return rep(200, { tiroirs: data ?? [] });
  }

  if (req.method !== "PUT" && req.method !== "POST") return rep(405, { code: "methode" });
  if (Number(req.headers.get("Content-Length") ?? 0) > MAX + 10_000) return rep(413, { code: "trop_gros" });
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
  if (!NOMS.has(nom) || !contenu || contenu.length > MAX || !Number.isInteger(rev) || rev < 0) return rep(400, { code: "invalide" });

  if (req.method === "POST") {
    if (b.garder !== true) return rep(400, { code: "invalide" });
    const { error } = await db.from("tiroirs_versions").insert({ user_id: userId, nom, rev: rev || null, contenu, modifie, appareil, raison: "conflit" });
    return error ? rep(500, { code: "erreur" }) : rep(200, { ok: true });
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
