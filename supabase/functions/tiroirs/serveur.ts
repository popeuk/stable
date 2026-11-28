// Le serveur de la fonction « tiroirs », partagé par la production (tiroirs)
// et sa jumelle de préprod (tiroirs-preprod) : seules changent les deux tables
// et l'adresse du site qui vérifie les comptes (`Config`).
//
// C'est la seule porte vers la copie des données de gestion. Le compte est celui de mon-ecurie.fr : on vérifie son jeton
// (X-BS-Token) auprès du site, puis on ne touche qu'aux tiroirs de ce compte.
// Depuis le 27 novembre 2026 (équipe d'une écurie, pc-bestable 1.10.0) :
// avec l'en-tête X-BS-Espace, un membre d'équipe ouvre les tiroirs de
// l'écurie de son gérant, si le site le compte parmi ses « espaces ».
// Le contenu arrive déjà prêt de l'app (chiffré, ou en clair compressé depuis
// le 28 novembre 2026) ; il n'est jamais lu ici.
//
//   GET                → { tiroirs: [{ nom, rev, contenu, modifie }], formats, canal }
//                        (formats : les préfixes acceptés, « bs-enc1: », « bs-enc2: » et « bs-clair2: » ;
//                         canal : le canal Realtime de l'écurie ouverte, le même pour le gérant et ses membres)
//   PUT  { nom, contenu, rev, modifie, appareil }
//                      → 200 { rev } si `rev` est la version connue du serveur
//                        (0 = pas encore de copie), sinon 409 { tiroir }.
//                        Après un 200, un message « rev » { nom, rev, appareil }
//                        part sur le canal de l'écurie (jamais le contenu).
//   POST { nom, contenu, rev, modifie, appareil, garder: true }
//                      → garde une copie perdante d'un conflit dans les versions
//                        (on en garde 30 par tiroir, comme pour les remplacées)
//
// Garde-fous (audit du 18 octobre, I6, M1, F4) : 2 Mo au plus par envoi,
// contenu dans un des formats annoncés (« bs-enc1: », « bs-enc2: » compressé puis chiffré,
// « bs-clair2: » compressé en clair), 6 envois par minute et par compte,
// jeton au bon format avant tout appel au site, refus gardés 5 minutes,
// jetons bons gardés 2 minutes, appels au site limités par adresse IP.
// Les compteurs vivent dans la mémoire de l'instance : ils freinent un abus,
// ils ne sont pas exacts à l'unité quand Supabase lance plusieurs instances.
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { CACHE_OK_MS, CACHE_REFUS_MS, FORMATS, Fenetre, MAX, Memoire, VERSIONS, canal, contenuAccepte, jetonBienForme, versionsEnTrop } from "./regles.ts";

/** Ce qui distingue la production de la préprod. */
export interface Config {
  /** La table des tiroirs. */
  tiroirs: string;
  /** La table des versions gardées (remplacées par le déclencheur, perdantes d'un conflit). */
  versions: string;
  /** L'API du site qui vérifie les comptes (sans « / » final). */
  monecurie: string;
}

/** La production : les valeurs d'avant le 28 novembre 2026, inchangées. */
export const PRODUCTION: Config = {
  tiroirs: "tiroirs",
  versions: "tiroirs_versions",
  monecurie: (Deno.env.get("MONECURIE_API") ?? "https://www.mon-ecurie.fr/wp-json/bestable/v1").replace(/\/$/, ""),
};

/**
 * La préprod : ses tables (0004_tiroirs_preprod.sql) et le site de préprod.
 * L'adresse est écrite en dur : les secrets d'un projet Supabase sont communs
 * à toutes ses fonctions, MONECURIE_API mènerait donc au site de production.
 */
export const PREPROD: Config = {
  tiroirs: "tiroirs_preprod",
  versions: "tiroirs_versions_preprod",
  monecurie: "https://f8a2-d405641a5d0e.wptiger.fr/wp-json/bestable/v1",
};

const NOMS = new Set(["be-stable-data", "be-stable-settings"]);
const ORIGINES = [
  /^https:\/\/popeuk\.github\.io$/,
  /^https:\/\/([a-z0-9-]+\.)?bestable\.fr$/,
  /^https:\/\/app\.187-7-74-179\.sslip\.io$/,
  /^https:\/\/preprod-app\.187-7-74-179\.sslip\.io$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(URL_SUPABASE, CLE_SERVICE, { auth: { persistSession: false } });

/** Jetons déjà vérifiés (2 minutes) et jetons refusés (5 minutes), dans cette instance. */
const connus = new Memoire<{ id: number; espaces: number[] }>(CACHE_OK_MS);
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
    "Access-Control-Allow-Headers": "Content-Type, X-BS-Token, X-BS-Espace",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  if (ORIGINES.some((r) => r.test(o))) h["Access-Control-Allow-Origin"] = o;
  return h;
}

async function compte(monecurie: string, token: string, adresse: string): Promise<{ id: number; espaces: number[] } | "refuse" | "injoignable" | "trop"> {
  if (!jetonBienForme(token) || refuses.lire(token)) return "refuse";
  const c = connus.lire(token);
  if (c) return c;
  if (verifs.depasse(adresse)) return "trop";
  const stop = new AbortController();
  const t = setTimeout(() => stop.abort(), 15000);
  try {
    const r = await fetch(`${monecurie}/moi`, { headers: { Accept: "application/json", "X-BS-Token": token }, signal: stop.signal });
    if (r.status === 401 || r.status === 403) {
      refuses.poser(token, true);
      return "refuse";
    }
    if (!r.ok) return "injoignable";
    const j = (await r.json()) as { user?: { id?: unknown }; espaces?: unknown };
    const id = Number(j?.user?.id);
    if (!Number.isInteger(id) || id <= 0) return "injoignable";
    // Le numéro du jeton doit être celui du compte rendu par le site.
    if (token.split(".")[0] !== String(id)) return "refuse";
    const espaces = Array.isArray(j?.espaces) ? j.espaces.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
    const c = { id, espaces };
    connus.poser(token, c);
    return c;
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

/**
 * Prévient l'écurie qu'un tiroir a changé (Realtime, diffusion par l'API REST).
 * Jamais plus de 2 secondes, jamais d'erreur rendue : un échec est seulement
 * journalisé, la copie est déjà gardée et les appareils la verront au prochain GET.
 * Le message ne porte que { nom, rev, appareil }, jamais le contenu.
 */
async function diffuser(sujet: string, message: { nom: string; rev: number; appareil: string | null }): Promise<void> {
  try {
    const r = await fetch(`${URL_SUPABASE}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CLE_SERVICE, Authorization: `Bearer ${CLE_SERVICE}` },
      body: JSON.stringify({ messages: [{ topic: sujet, event: "rev", payload: message, private: false }] }),
      signal: AbortSignal.timeout(2000),
    });
    if (!r.ok) console.warn("tiroirs : diffusion refusée", r.status);
  } catch (e) {
    console.warn("tiroirs : diffusion impossible", e instanceof Error ? e.name : String(e));
  }
}

/** Lance la fonction avec les tables et le site de `c`. */
export function servir(c: Config): void {
  // Le secret du canal est la clé de service. La préprod partage ce projet
  // Supabase (donc la clé et Realtime) mais pas les comptes : ses numéros
  // d'écurie recoupent ceux de la production. On y ajoute le nom de sa table
  // pour que l'écurie 32 de préprod n'écoute jamais l'écurie 32 de production.
  const secretCanal = c.tiroirs === PRODUCTION.tiroirs ? CLE_SERVICE : `${CLE_SERVICE}|${c.tiroirs}`;

  Deno.serve(async (req) => {
    const h = entetes(req);
    const rep = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: h });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });

    const token = req.headers.get("X-BS-Token") ?? "";
    if (!token || token.length > 512) return rep(401, { code: "session_expiree", message: "Connexion nécessaire." });
    const qui = await compte(c.monecurie, token, ip(req));
    if (qui === "trop") return rep(429, { code: "trop_d_essais", message: "Trop d’essais. Réessaie dans une minute." });
    if (qui === "refuse") return rep(401, { code: "session_expiree", message: "Connexion nécessaire." });
    if (qui === "injoignable") return rep(503, { code: "monecurie_injoignable", message: "bestable.fr ne répond pas." });
    // L'écurie ouverte : la sienne, ou celle d'un gérant qui l'a dans son équipe (X-BS-Espace).
    const demande = req.headers.get("X-BS-Espace");
    const espace = demande ? Number(demande) : qui.id;
    if (!Number.isInteger(espace) || espace <= 0) return rep(400, { code: "invalide" });
    if (espace !== qui.id && !qui.espaces.includes(espace)) return rep(403, { code: "hors_equipe", message: "Tu ne fais plus partie de cette équipe." });
    // `userId` est l'écurie des tiroirs lus et écrits ; c'est aussi elle qui
    // donne le canal, pour que le gérant et ses membres soient sur le même.
    const userId = espace;

    if (req.method === "GET") {
      const { data, error } = await db.from(c.tiroirs).select("nom, rev, contenu, modifie").eq("user_id", userId);
      if (error) return rep(500, { code: "erreur", message: "Lecture impossible." });
      return rep(200, { tiroirs: data ?? [], formats: FORMATS, canal: await canal(userId, secretCanal) });
    }

    if (req.method !== "PUT" && req.method !== "POST") return rep(405, { code: "methode" });
    if (Number(req.headers.get("Content-Length") ?? 0) > MAX + 10_000) return rep(413, { code: "trop_gros" });
    if (envois.depasse(`${qui.id}|${userId}`)) return rep(429, { code: "trop_d_envois", message: "Trop d’envois. La copie repart dans une minute." });
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
    if (!NOMS.has(nom) || !contenuAccepte(contenu) || !Number.isInteger(rev) || rev < 0) return rep(400, { code: "invalide" });

    if (req.method === "POST") {
      if (b.garder !== true) return rep(400, { code: "invalide" });
      const { error } = await db.from(c.versions).insert({ user_id: userId, nom, rev: rev || null, contenu, modifie, appareil, raison: "conflit" });
      if (error) return rep(500, { code: "erreur" });
      // Le ménage, comme après une mise à jour : les 30 versions les plus récentes du tiroir.
      const { data: toutes } = await db
        .from(c.versions)
        .select("id")
        .eq("user_id", userId)
        .eq("nom", nom)
        .order("gardee_le", { ascending: false })
        .order("id", { ascending: false })
        .limit(VERSIONS + 200);
      const enTrop = versionsEnTrop((toutes ?? []) as { id: number }[]);
      if (enTrop.length) await db.from(c.versions).delete().eq("user_id", userId).in("id", enTrop);
      return rep(200, { ok: true });
    }

    const ligne = { contenu, modifie, appareil, rev: rev + 1, maj: new Date().toISOString() };
    const { data, error } =
      rev === 0
        ? await db.from(c.tiroirs).insert({ user_id: userId, nom, ...ligne }).select("rev")
        : await db.from(c.tiroirs).update(ligne).eq("user_id", userId).eq("nom", nom).eq("rev", rev).select("rev");
    if (error && error.code !== "23505") return rep(500, { code: "erreur" });
    if (!error && data?.length) {
      const nouvelle = Number(data[0].rev);
      // La diffusion continue après la réponse quand l'environnement le permet
      // (EdgeRuntime.waitUntil) ; sinon on l'attend, 2 secondes au plus.
      const envoi = canal(userId, secretCanal).then((sujet) => diffuser(sujet, { nom, rev: nouvelle, appareil }));
      const er = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
      if (er?.waitUntil) er.waitUntil(envoi.catch(() => {}));
      else await envoi.catch(() => {});
      return rep(200, { rev: data[0].rev });
    }

    // Le serveur a une autre version : on la rend, l'app choisit.
    const { data: actuel } = await db.from(c.tiroirs).select("nom, rev, contenu, modifie").eq("user_id", userId).eq("nom", nom).maybeSingle();
    return rep(409, { code: "conflit", tiroir: actuel });
  });
}
