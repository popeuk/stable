"use client";

import { getSession, scopedKey } from "@/lib/account/session";
import { estPlacePleine, noterPlacePleine } from "@/lib/account/place";
import { signalerErreur } from "@/lib/suivi-erreurs";

/**
 * Le format en clair (lib/account/format-clair) se charge à la demande, à la
 * première lecture ou au premier envoi : il n'est pas dans le paquet de
 * l'Accueil. Seul le test du préfixe reste ici (le même que PREFIXE_CLAIR).
 */
const estClair = (c: string) => c.startsWith("bs-clair2:");

/**
 * Un morceau chargé à la demande (format-clair, departager, supabase-js) qui
 * n'a pas pu se charger : le navigateur garde l'échec et ne le retente pas
 * (un déploiement a changé son nom, ou le réseau a coupé à ce moment-là).
 * Plus rien ne part ni ne se lit jusqu'au rechargement de l'app : on ne dit
 * donc plus « à jour », on le signale une fois à Samuel, et le bandeau de la
 * copie propose de recharger (`morceauManquant`).
 */
let manque = false;
export function morceauManquant(): boolean {
  return manque;
}
export function signalerMorceauManquant() {
  if (manque) return;
  manque = true;
  derniere = { quand: new Date().toISOString(), ok: false };
  void signalerErreur("copie", "morceau non chargé");
  signalerRefus();
}
export async function charger<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (err) {
    signalerMorceauManquant();
    throw err;
  }
}
const formatClair = () => charger(() => import("@/lib/account/format-clair"));
/** Lit un contenu venu du serveur (lève seulement si le format n'a pas pu se charger : rien n'est alors touché). */
async function depuisDistant(contenu: string, ouvrirScelle: (s: string) => Promise<string | null>): Promise<string | null> {
  return (await formatClair()).depuisDistant(contenu, ouvrirScelle);
}

/**
 * La copie en ligne des tiroirs d'un compte (Supabase, projet `bestable`).
 *
 * Décision du 28 novembre 2026 : le serveur reçoit et garde le contenu en
 * clair, compressé (« bs-clair2: », lib/account/format-clair), au lieu d'une
 * copie chiffrée qu'il ne pouvait pas lire. L'appareil, lui, garde ses
 * tiroirs scellés avec la clé du compte (lib/account/vault), comme avant.
 * Une copie en ligne encore chiffrée (« bs-enc1: » / « bs-enc2: ») reste
 * lue, puis renvoyée en clair. Un navigateur sans CompressionStream ou sans
 * DecompressionStream (Safari iOS avant 16.4) ne synchronise plus du tout :
 * il garde ses données sur l'appareil, et on le signale (TEXTE_TROP_ANCIEN).
 * Le serveur garde la dernière version de chaque tiroir et les 30 précédentes.
 *
 * Chaque tiroir porte un numéro de version (`rev`). On envoie en disant
 * quelle version on avait reçue ; si le serveur en a une plus récente
 * (un autre appareil a écrit), il la rend et on choisit :
 * - l'appareil n'a jamais été synchronisé : la copie en ligne gagne ;
 * - sinon, la modification la plus récente gagne ;
 * - les factures des deux côtés sont toujours gardées (fusionFactures) ;
 * - la copie perdante est gardée sur le serveur.
 *
 * Rien ne part avant la première lecture du serveur dans la session, pour
 * qu'un appareil neuf ne remplace jamais les données d'un autre.
 */
export const NUAGE_URL = (process.env.NEXT_PUBLIC_NUAGE_URL ?? "https://wgvithqivsygsoeyqruz.supabase.co/functions/v1/tiroirs").replace(/\/$/, "");
export const TIROIRS = ["be-stable-data", "be-stable-settings"] as const;
type Nom = (typeof TIROIRS)[number];
const estNom = (n: string): n is Nom => (TIROIRS as readonly string[]).includes(n);

/** Allumée pour tous les comptes. Interrupteur de secours : ?nuage=0 l'éteint sur cet appareil, ?nuage=1 la rallume. */
const DRAPEAU = "bs-nuage";

export interface Distant {
  nom: string;
  rev: number;
  contenu: string;
  modifie: string;
}

interface EtatTiroir {
  /** La version du serveur sur laquelle l'appareil est aligné (0 = aucune). */
  rev: number;
  /** Empreinte du contenu (en clair) aligné sur le serveur. */
  empreinte?: string;
  /** Empreinte du contenu actuel de l'appareil. */
  locale?: string;
  /** Une modification attend d'être envoyée. */
  sale?: boolean;
  /** Quand l'appareil a modifié ce tiroir pour la dernière fois. */
  modifie?: string;
  /** L'appareil a déjà été aligné sur le serveur au moins une fois. */
  vu?: boolean;
  /** Combien de changements attendent d'être envoyés (pour Mon compte). */
  n?: number;
  /** Quand la copie en ligne a été à jour pour la dernière fois (ISO). */
  aligne?: string;
  /**
   * Le serveur a refusé ce tiroir et le refusera encore : trop gros (413) ou
   * mal formé (400). On ne renvoie plus pour rien : seulement quand le contenu
   * a rapetissé (trop gros) ou changé de forme, ou le lendemain (mal formé).
   */
  refus?: Refus;
}
export type CodeRefus = "trop_gros" | "invalide";
interface Refus {
  code: CodeRefus;
  /** La taille de ce qui a été refusé (en caractères). */
  taille: number;
  /** Le début de ce qui a été refusé (le préfixe du format). */
  prefixe: string;
  quand: string;
}
type Etat = Partial<Record<Nom, EtatTiroir>>;

/** Ce que la copie en ligne a besoin de savoir faire avec le coffre (injecté par vault.ts). */
export interface Coffre {
  /** Le contenu en clair d'un tiroir de l'appareil. */
  lire(nom: string): Promise<string | null>;
  /** Déchiffre un contenu venu du serveur (null si la clé ne l'ouvre pas). */
  ouvrir(scelle: string): Promise<string | null>;
  /** Écrit un contenu en clair dans le tiroir (il est chiffré au passage). */
  ecrire(nom: string, clair: string): Promise<void>;
  /** Plus utilisé par la copie en ligne depuis le 28 novembre 2026 (elle part en clair) ; vault.ts le fournit encore. */
  ancienFormat?(scelle: string): Promise<string | null>;
}
let coffre: Coffre | null = null;
export function brancherCoffre(c: Coffre) {
  coffre = c;
}

let tire = false;
let minuteur: ReturnType<typeof setTimeout> | null = null;
let enCours: Promise<void> | null = null;
let derniere: { quand: string; ok: boolean } | null = null;

/** La phrase pour la gérante quand son navigateur ne sait pas lire ni écrire la copie en clair. */
export const TEXTE_TROP_ANCIEN = "Ton téléphone est trop ancien pour la copie en ligne : mets-le à jour pour partager avec ton équipe.";

/**
 * Ce navigateur ne sait pas compresser ou décompresser (Safari iOS avant
 * 16.4) : il ne pourrait ni envoyer en clair ni lire la copie des autres
 * appareils. Il ne synchronise donc plus du tout.
 */
export function navigateurTropAncien(): boolean {
  return typeof CompressionStream !== "function" || typeof DecompressionStream !== "function";
}
let tropAncienSignale = false;
/** Dit une fois par session que ce navigateur est trop ancien (rien de l'écurie dans le message). */
function signalerTropAncien() {
  if (tropAncienSignale) return;
  tropAncienSignale = true;
  void signalerErreur("copie", TEXTE_TROP_ANCIEN);
}

/** Ce qui part au serveur pour un contenu en clair : « bs-clair2: » (null si la compression échoue). */
async function pourServeur(clair: string): Promise<string | null> {
  try {
    return await (await formatClair()).versClair(clair);
  } catch {
    return null;
  }
}

/** Un refus qui tient encore : renvoyer la même chose serait refusé pareil. */
export function refusTient(r: Refus | undefined, raw: string, maintenant = Date.now()): boolean {
  if (!r) return false;
  if (r.code === "trop_gros") return raw.length >= r.taille;
  return raw.slice(0, 8) === r.prefixe && maintenant - Date.parse(r.quand) < 24 * 3600_000;
}

export function nuageAllume(): boolean {
  // En préproduction (NEXT_PUBLIC_NUAGE_URL=off), la copie en ligne reste éteinte : rien n'écrit dans les tiroirs réels.
  if (NUAGE_URL === "off") return false;
  try {
    return localStorage.getItem(DRAPEAU) !== "0";
  } catch {
    return false;
  }
}

/**
 * Le serveur accepte-t-il le contenu compressé (« bs-enc2: ») ? Il le dit
 * dans la réponse du GET (`formats`) ; tant qu'il ne l'a pas dit, le coffre
 * écrit l'ancien format (lib/account/vault).
 */
const GZIP = "bs-nuage-gzip";
export function compressionPermise(): boolean {
  try {
    return localStorage.getItem(GZIP) === "1";
  } catch {
    return false;
  }
}
function noterFormats(formats: unknown) {
  try {
    if (Array.isArray(formats) && formats.includes("bs-enc2:")) localStorage.setItem(GZIP, "1");
    else localStorage.removeItem(GZIP);
  } catch {}
}

/** Lit ?nuage=1 / ?nuage=0 dans l'adresse et le garde sur l'appareil. */
export function lireDrapeau(search: string) {
  const v = new URLSearchParams(search).get("nuage");
  try {
    if (v === "1") localStorage.removeItem(DRAPEAU);
    if (v === "0") localStorage.setItem(DRAPEAU, "0");
  } catch {}
}

// Lu dès le chargement : une redirection (vers l'accueil, la connexion) ferait perdre le paramètre.
if (typeof window !== "undefined" && typeof window.location?.search === "string") lireDrapeau(window.location.search);

/** Un compte, la copie allumée, mais un navigateur trop ancien pour elle. */
function tropAncienPourCompte(): boolean {
  return getSession()?.kind === "compte" && nuageAllume() && navigateurTropAncien();
}

function actif(): boolean {
  return getSession()?.kind === "compte" && nuageAllume() && !navigateurTropAncien();
}

const cleEtat = () => scopedKey("bs-nuage");
function lireEtat(): Etat {
  try {
    return (JSON.parse(localStorage.getItem(cleEtat()) ?? "{}") as Etat) ?? {};
  } catch {
    return {};
  }
}
function ecrireEtat(e: Etat) {
  try {
    localStorage.setItem(cleEtat(), JSON.stringify(e));
  } catch (err) {
    if (estPlacePleine(err)) noterPlacePleine();
  }
}
function majTiroir(nom: Nom, patch: Partial<EtatTiroir>) {
  const e = lireEtat();
  e[nom] = { rev: 0, ...e[nom], ...patch };
  ecrireEtat(e);
}

/**
 * La dernière version commune avec le serveur, au format du serveur (en
 * clair, « bs-clair2: » ; une ancienne base chiffrée se lit encore) : c'est
 * la base de la fusion quand les deux côtés ont changé.
 */
const cleBase = (nom: Nom) => scopedKey(`bs-nuage-base:${nom}`);
function garderBase(nom: Nom, contenu: string) {
  try {
    localStorage.setItem(cleBase(nom), contenu);
  } catch (err) {
    if (estPlacePleine(err)) noterPlacePleine();
  }
}

/** L'identifiant de cet appareil, envoyé avec chaque écriture (le canal de l'écurie le renvoie). */
export function appareil(): string {
  try {
    let id = localStorage.getItem("bs-appareil");
    if (!id) {
      id = `${navigator.platform || "appareil"}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem("bs-appareil", id);
    }
    return id;
  } catch {
    return "appareil";
  }
}

/** La version du serveur sur laquelle cet appareil est aligné pour ce tiroir (0 = aucune). */
export function revConnue(nom: string): number {
  return estNom(nom) ? (lireEtat()[nom]?.rev ?? 0) : 0;
}

/**
 * Le canal Realtime de l'écurie ouverte, tel que le GET l'a donné
 * (« ecurie- » et 24 caractères hexadécimaux), avec le tiroir de la session
 * qui l'a reçu : un autre compte ou un autre espace d'équipe n'en hérite pas.
 */
let canalRecu: { portee: string; nom: string } | null = null;
const FORME_CANAL = /^ecurie-[0-9a-f]{24}$/;
function noterCanal(c: unknown) {
  canalRecu = typeof c === "string" && FORME_CANAL.test(c) ? { portee: cleEtat(), nom: c } : null;
}
/** Le canal de l'écurie (la dernière valeur reçue), ou null : pas de copie en ligne, navigateur trop ancien, autre session. */
export function canalDeLEcurie(): string | null {
  if (!actif() || !canalRecu || canalRecu.portee !== cleEtat()) return null;
  return canalRecu.nom;
}

/** En équipe, une écriture part au bout de 800 ms (les autres la voient vite), sinon au bout de 4 s. */
function delaiEnvoi(): number {
  const s = getSession();
  return s?.kind === "compte" && (!!s.espace || !!s.avecEquipe) ? 800 : 4000;
}

export async function empreinte(clair: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(clair));
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function appel(method: "GET" | "PUT" | "POST", body?: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const s = getSession();
  if (s?.kind !== "compte") return { status: 401, json: {} };
  if (NUAGE_URL === "off") return { status: 503, json: {} };
  const stop = new AbortController();
  const t = setTimeout(() => stop.abort(), 30000);
  try {
    const res = await fetch(NUAGE_URL, {
      method,
      headers: { "X-BS-Token": s.token, ...(s.espace ? { "X-BS-Espace": String(s.espace.id) } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "omit",
      signal: stop.signal,
    });
    return { status: res.status, json: ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown> };
  } catch {
    return { status: 0, json: {} };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Les tiroirs remplacés par la copie en ligne que l'écran n'a pas encore
 * relus. Tant qu'ils ne sont pas relus, l'app a encore les anciennes données
 * en mémoire : une écriture faite d'ici là (l'autopilote au retour sur
 * l'app) effacerait ce qui vient d'arriver. Le coffre l'ignore donc
 * (`ecritureBloquee`), jusqu'à la relecture (`relu`).
 */
const aRelire = new Set<string>();
function marquerARelire(nom: Nom) {
  aRelire.add(scopedKey(nom));
}
export function ecritureBloquee(nom: string): boolean {
  return aRelire.has(scopedKey(nom));
}
export function relu(nom: string) {
  aRelire.delete(scopedKey(nom));
}

/** Les écritures en train d'être notées (pour attendre qu'elles le soient). */
const notes = new Set<Promise<void>>();
export async function notesFaites(): Promise<void> {
  while (notes.size) await Promise.all([...notes]);
}

/** Le coffre vient d'écrire un tiroir : s'il a changé, on l'enverra. */
export function noterEcriture(nom: string, clair: string): Promise<void> {
  const p = noter(nom, clair).finally(() => notes.delete(p));
  notes.add(p);
  return p;
}
async function noter(nom: string, clair: string): Promise<void> {
  // Trop ancien : rien ne part, mais le changement est noté, pour partir (ou se fusionner) après la mise à jour.
  if (!estNom(nom) || !(actif() || tropAncienPourCompte())) return;
  const h = await empreinte(clair);
  const e = lireEtat()[nom];
  if (e?.empreinte === h && !e.sale) return;
  if (e?.locale === h && e.sale) return;
  majTiroir(nom, { sale: true, locale: h, modifie: new Date().toISOString(), n: (e?.sale ? (e.n ?? 1) : 0) + 1 });
  if (actif()) planifierEnvoi(delaiEnvoi());
}

export function planifierEnvoi(ms = 4000) {
  if (minuteur) clearTimeout(minuteur);
  minuteur = setTimeout(() => {
    minuteur = null;
    void envoyer();
  }, ms);
}

/**
 * Les tiroirs dont la dernière écriture venue de la copie en ligne n'a pas pu
 * se faire (plus de place, pas de clé) : l'envoi attend alors une minute au
 * lieu de repartir aussitôt en 409, en boucle.
 */
const ecritureRatee = new Set<Nom>();
/** Les copies de l'appareil déjà gardées sur le serveur (version distante et empreinte) : pas deux fois la même. */
const dejaGardees = new Set<string>();

/** Écrit un contenu dans le tiroir par le coffre, et vérifie qu'il y est bien. */
async function ecrireVerifie(nom: Nom, clair: string): Promise<boolean> {
  marquerARelire(nom);
  await coffre!.ecrire(nom, clair);
  await notesFaites();
  if ((await coffre!.lire(nom)) !== clair) {
    relu(nom);
    ecritureRatee.add(nom);
    return false;
  }
  return true;
}

/**
 * La copie en ligne remplace celle de l'appareil : écrite scellée par le
 * coffre. Rend false si elle n'a pas pu l'être (plus de place sur l'appareil).
 */
async function adopterDistant(nom: Nom, d: Distant, clairD: string): Promise<boolean> {
  if (!(await ecrireVerifie(nom, clairD))) return false;
  garderBase(nom, estClair(d.contenu) ? d.contenu : ((await pourServeur(clairD)) ?? d.contenu));
  const h = await empreinte(clairD);
  // Encore chiffrée en ligne : on la renverra en clair.
  const renvoyer = !estClair(d.contenu);
  majTiroir(nom, { rev: d.rev, empreinte: h, locale: h, sale: renvoyer, vu: true, modifie: d.modifie, ...(renvoyer ? { n: 1 } : {}) });
  return true;
}

/** Le serveur a une version que l'appareil n'a pas : on l'aligne. Rend true si l'appareil a changé. */
async function resoudre(nom: Nom, d: Distant | null, simple = false): Promise<boolean> {
  if (!coffre) return false;
  if (!d) {
    // Le serveur n'a plus rien : on renvoie tout.
    majTiroir(nom, { rev: 0, sale: true });
    return false;
  }
  const e = lireEtat()[nom] ?? { rev: 0 };
  const clairD = await depuisDistant(d.contenu, (s) => coffre!.ouvrir(s));
  if (clairD === null) {
    // Illisible (clé d'un autre compte, contenu abîmé) : on ne touche pas à l'appareil, et on le renvoie.
    // La copie en ligne est alors remplacée, mais le serveur la garde dans ses versions : elle reste récupérable.
    majTiroir(nom, { rev: d.rev, sale: true, vu: true });
    return false;
  }
  // « simple » (rien d'attendu) seulement si l'appareil a bien ce qui était aligné : une écriture
  // qui aurait échappé au suivi passe alors par le choix ci-dessous au lieu d'être remplacée.
  let clairL = await coffre.lire(nom);
  if (simple && clairL !== null && (await empreinte(clairL)) === e.empreinte) clairL = null;
  if (clairL === null) return adopterDistant(nom, d, clairD);
  const baseRaw = localStorage.getItem(cleBase(nom));
  const base = baseRaw ? await depuisDistant(baseRaw, (s) => coffre!.ouvrir(s)) : null;
  // Le choix (et la fusion) ne sert qu'aux conflits : chargé à la demande, hors du paquet de l'Accueil.
  const { departager } = await charger(() => import("@/lib/account/departager"));
  const choix = departager(nom, { clair: clairL, modifie: e.modifie, vu: e.vu }, { clair: clairD, modifie: d.modifie }, base);
  if (choix.gagnant === "distant") {
    // Sans fusion, la copie de l'appareil est gardée sur le serveur avant d'être remplacée.
    if (!choix.fusion && clairL !== clairD) {
      const deja = `${nom}:${d.rev}:${await empreinte(clairL)}`;
      const contenu = dejaGardees.has(deja) ? null : await pourServeur(clairL);
      if (contenu && (await appel("POST", { nom, contenu, rev: e.rev, modifie: e.modifie, appareil: appareil(), garder: true })).status === 200) dejaGardees.add(deja);
    }
    if (choix.clair === clairD) return adopterDistant(nom, d, clairD);
  }
  // L'appareil gagne, ou la copie gagnante reçoit des factures de l'autre : on l'écrit et on l'envoie.
  // Pas écrite (plus de place) : on ne s'aligne pas, sinon l'envoi suivant remplacerait la copie en ligne par l'ancienne de l'appareil.
  if (choix.clair !== clairL && !(await ecrireVerifie(nom, choix.clair))) return false;
  majTiroir(nom, { rev: d.rev, vu: true, empreinte: await empreinte(clairD) });
  garderBase(nom, estClair(d.contenu) ? d.contenu : ((await pourServeur(clairD)) ?? d.contenu));
  majTiroir(nom, { sale: true, locale: await empreinte(choix.clair), modifie: new Date().toISOString() });
  return choix.clair !== clairL;
}

/** Le serveur a une autre version que celle de l'appareil : on s'aligne dessus. Rend true si l'appareil a changé. */
async function aligner(nom: Nom, d: Distant): Promise<boolean> {
  const e = lireEtat()[nom];
  // Le serveur est revenu en arrière (restauration) : on le suit comme une version nouvelle.
  if (e?.vu && d.rev < e.rev) majTiroir(nom, { rev: d.rev });
  // Rien d'attendu sur l'appareil : la copie en ligne remplace simplement.
  return resoudre(nom, d, !localStorage.getItem(scopedKey(nom)) || (!!e?.vu && !e.sale));
}

/** Envoie ce qui attend, en clair (« bs-clair2: »). */
export async function envoyer(): Promise<void> {
  if (tropAncienPourCompte()) signalerTropAncien();
  if (!actif() || !tire || !coffre) return;
  let refuse = false;
  for (const nom of TIROIRS) {
    const e = lireEtat()[nom];
    if (!e?.sale) continue;
    const raw = localStorage.getItem(scopedKey(nom));
    if (!raw) continue;
    const clair = await coffre.lire(nom);
    if (clair === null) continue;
    const contenu = await pourServeur(clair);
    if (!contenu) continue;
    // Refusé tel quel juste avant : renvoyer la même chose ne servirait à rien. La taille est celle de ce qui part.
    if (refusTient(e.refus, contenu)) {
      refuse = true;
      continue;
    }
    const envoye = e.locale;
    const r = await appel("PUT", { nom, contenu, rev: e.rev, modifie: e.modifie ?? new Date().toISOString(), appareil: appareil() });
    if (r.status === 200 && typeof r.json.rev === "number") {
      garderBase(nom, contenu);
      const now = lireEtat()[nom];
      const toujours = now?.locale === envoye;
      majTiroir(nom, { rev: r.json.rev, vu: true, refus: undefined, ...(toujours ? { sale: false, empreinte: envoye, n: 0, aligne: new Date().toISOString() } : {}) });
      if (e.refus) signalerRefus();
      if (!toujours) planifierEnvoi(delaiEnvoi());
    } else if (r.status === 409) {
      ecritureRatee.delete(nom);
      const changed = await resoudre(nom, (r.json.tiroir as Distant | null) ?? null);
      if (changed) notifier(new Set([nom]));
      // La copie en ligne n'a pas pu s'écrire ici : réessayer tout de suite referait la même chose.
      planifierEnvoi(ecritureRatee.has(nom) ? 60000 : 500);
    } else if (r.status === 413 || r.status === 400) {
      // Trop gros, ou mal formé : il sera refusé encore. On le dit (Mon compte, bandeau) sans réessayer.
      majTiroir(nom, { refus: { code: r.status === 413 ? "trop_gros" : "invalide", taille: contenu.length, prefixe: contenu.slice(0, 8), quand: new Date().toISOString() } });
      signalerRefus();
      // Samuel le sait aussi : seulement le code du refus et la taille, rien du contenu.
      void signalerErreur("copie", `copie en ligne refusée : ${r.status === 413 ? "trop_gros" : "invalide"}, ${Math.round(contenu.length / 1000)} Ko`);
      refuse = true;
    } else {
      // 429 (trop d'envois d'un coup), réseau, serveur : on réessaie dans une minute, sans rien dire.
      derniere = { quand: new Date().toISOString(), ok: false };
      if (r.status !== 401) planifierEnvoi(60000);
      return;
    }
  }
  derniere = { quand: new Date().toISOString(), ok: !refuse && !manque };
}

/** Ce que le serveur refuse en ce moment, le plus grave d'abord (trop gros). */
export function refusCopie(): CodeRefus | null {
  if (!actif()) return null;
  const e = lireEtat();
  const codes = TIROIRS.map((n) => e[n]?.refus?.code).filter((c): c is CodeRefus => !!c);
  return codes.includes("trop_gros") ? "trop_gros" : (codes[0] ?? null);
}
const ecoutesRefus = new Set<() => void>();
/** Pour le bandeau : prévenu quand un refus arrive ou s'en va. */
export function ecouterRefus(f: () => void) {
  ecoutesRefus.add(f);
  return () => {
    ecoutesRefus.delete(f);
  };
}
function signalerRefus() {
  for (const f of ecoutesRefus) f();
}

/**
 * Lit le serveur et aligne l'appareil. Rend les tiroirs qui ont changé sur
 * l'appareil (il faut alors relire les données à l'écran).
 *
 * Une lecture déjà en cours suffit d'habitude. Avec `encore` (le canal vient
 * d'annoncer une version que cette lecture-là n'avait peut-être pas), on
 * attend qu'elle finisse, puis on relit une fois de plus.
 */
export async function synchroniser(encore = false): Promise<Set<string>> {
  const changes = new Set<string>();
  if (tropAncienPourCompte()) signalerTropAncien();
  if (!actif() || !coffre) return changes;
  if (enCours && !encore) {
    await enCours;
    return changes;
  }
  while (enCours) await enCours;
  let fin!: () => void;
  let interrompue = false;
  enCours = new Promise((r) => (fin = r));
  try {
    const r = await appel("GET");
    if (r.status !== 200) {
      derniere = { quand: new Date().toISOString(), ok: false };
      return changes;
    }
    noterFormats(r.json.formats);
    noterCanal(r.json.canal);
    const distants = new Map(((r.json.tiroirs ?? []) as Distant[]).map((d) => [d.nom, d]));
    for (const nom of TIROIRS) {
      const d = distants.get(nom);
      const e = lireEtat()[nom];
      const raw = localStorage.getItem(scopedKey(nom));
      if (!d) {
        if (raw) majTiroir(nom, { rev: 0, sale: true, modifie: e?.modifie ?? new Date().toISOString() });
        continue;
      }
      if (e?.vu && d.rev === e.rev) {
        // Alignés, mais la copie en ligne est encore chiffrée : on la renvoie en clair.
        if (!estClair(d.contenu) && !e.sale && raw) majTiroir(nom, { sale: true, n: 1 });
        continue;
      }
      if (await aligner(nom, d)) changes.add(nom);
    }
    tire = true;
    derniere = { quand: new Date().toISOString(), ok: true };
  } catch (err) {
    // Un morceau qui ne se charge pas (déjà signalé) : on ne dit pas « à jour ».
    if (!manque) throw err;
    derniere = { quand: new Date().toISOString(), ok: false };
    interrompue = true;
  } finally {
    enCours = null;
    fin();
  }
  // Même interrompue, les tiroirs déjà remplacés doivent être relus par l'écran : sinon le coffre ignorerait leurs écritures.
  if (changes.size) notifier(changes);
  if (!interrompue) await envoyer();
  return changes;
}

/**
 * Juste avant de donner un numéro de facture (question 18, réponse A) : tirer
 * la dernière version du tiroir des données et la réunir à l'appareil, pour
 * numéroter à partir du plus grand numéro connu, ici ou ailleurs.
 * - « seul » : pas de compte (essai, démo) ou copie éteinte, un seul appareil ;
 * - « a-jour » : le serveur a été lu ; `change` dit si l'appareil a changé
 *   (il faut alors relire les données à l'écran avant de numéroter) ;
 * - « hors-ligne » : le serveur n'a pas répondu, on ne sait pas ;
 * - « refusee » : le serveur a été lu, mais il refuse la copie de cet
 *   appareil (trop grosse, mal formée) : ses factures ne montent plus, l'autre
 *   appareil ne les voit pas et pourrait donner le même numéro.
 */
export async function relireAvantNumero(): Promise<{ etat: "seul" | "a-jour" | "hors-ligne" | "refusee"; change: boolean }> {
  if (!actif() || !coffre) return { etat: "seul", change: false };
  if (enCours) await enCours;
  const r = await appel("GET");
  if (r.status !== 200) {
    derniere = { quand: new Date().toISOString(), ok: false };
    return { etat: "hors-ligne", change: false };
  }
  const nom: Nom = "be-stable-data";
  const d = ((r.json.tiroirs ?? []) as Distant[]).find((x) => x.nom === nom);
  const e = lireEtat()[nom];
  const etat = refusCopie() ? "refusee" : "a-jour";
  if (!d || (e?.vu && d.rev === e.rev)) return { etat, change: false };
  let change: boolean;
  try {
    change = await aligner(nom, d);
  } catch (err) {
    // Un morceau qui ne se charge pas : on ne sait pas, comme sans réseau.
    if (!manque) throw err;
    return { etat: "hors-ligne", change: false };
  }
  if (change) notifier(new Set([nom]));
  return { etat, change };
}

/** Envoie tout de suite ce qui attend (une facture vient d'être numérotée : l'autre appareil doit la voir vite). */
export async function envoyerMaintenant(): Promise<void> {
  if (!actif()) return;
  await notesFaites();
  await envoyer();
}

/**
 * L'état brut de la copie en ligne, pour Mon compte : `etatNuage` (dans
 * lib/account/etat-copie, hors du paquet de l'Accueil) en fait le résumé.
 */
export function etatBrut() {
  return { e: lireEtat(), derniere, allume: actif(), refus: refusCopie(), tropAncien: tropAncienPourCompte(), recharger: manque };
}

/* Les écrans qui doivent relire leurs données quand un tiroir change. */
const ecoutes = new Set<(noms: Set<string>) => void>();
export function ecouterChangements(f: (noms: Set<string>) => void) {
  ecoutes.add(f);
  return () => ecoutes.delete(f);
}
function notifier(noms: Set<string>) {
  for (const f of ecoutes) f(noms);
}

/** Pour les tests. */
export function _reinitialiser() {
  aRelire.clear();
  tire = false;
  enCours = null;
  derniere = null;
  tropAncienSignale = false;
  ecritureRatee.clear();
  dejaGardees.clear();
  canalRecu = null;
  manque = false;
  if (minuteur) clearTimeout(minuteur);
  minuteur = null;
}
