"use client";

import { getSession, scopedKey } from "@/lib/account/session";
import { fusionFactures } from "@/lib/domain/factures-base";
import { fusionner3 } from "@/lib/account/fusion";
import type { StableData } from "@/lib/domain/types";
import { estPlacePleine, noterPlacePleine } from "@/lib/account/place";
import { signalerErreur } from "@/lib/suivi-erreurs";
import { depuisDistant, estClair, versClair } from "@/lib/account/format-clair";

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
    return await versClair(clair);
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

function appareil(): string {
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
  if (!estNom(nom) || !actif()) return;
  const h = await empreinte(clair);
  const e = lireEtat()[nom];
  if (e?.empreinte === h && !e.sale) return;
  if (e?.locale === h && e.sale) return;
  majTiroir(nom, { sale: true, locale: h, modifie: new Date().toISOString(), n: (e?.sale ? (e.n ?? 1) : 0) + 1 });
  planifierEnvoi();
}

export function planifierEnvoi(ms = 4000) {
  if (minuteur) clearTimeout(minuteur);
  minuteur = setTimeout(() => {
    minuteur = null;
    void envoyer();
  }, ms);
}

/**
 * Le choix entre la copie de l'appareil et celle du serveur. Pur : rend
 * le contenu à garder, et qui a gagné. Avec la dernière version commune,
 * les deux côtés se fusionnent (lib/account/fusion) : ce que chacun a
 * changé reste, le plus récent ne l'emporte que là où les deux ont changé
 * la même chose. Sans elle (appareil jamais aligné), la copie en ligne
 * gagne. Les factures des deux côtés restent toujours.
 */
export function departager(
  nom: string,
  locale: { clair: string; modifie?: string; vu?: boolean },
  distant: { clair: string; modifie: string },
  base: string | null = null,
): { gagnant: "locale" | "distant"; clair: string; fusion: boolean } {
  const distantGagne = !locale.vu || !locale.modifie || Date.parse(distant.modifie) >= Date.parse(locale.modifie);
  const fusion = locale.vu && base !== null ? fusionner3(base, locale.clair, distant.clair, !distantGagne) : null;
  const [g, p] = fusion !== null ? [fusion, distant.clair] : distantGagne ? [distant.clair, locale.clair] : [locale.clair, distant.clair];
  let clair = g;
  if (nom === "be-stable-data") {
    try {
      const pg = JSON.parse(g) as { state?: Partial<StableData> };
      const pp = JSON.parse(p) as { state?: Partial<StableData> };
      if (pg?.state && pp?.state) {
        const f = fusionFactures(pg.state as StableData, pp.state as StableData);
        const avant = (pg.state.invoices ?? []).length;
        const seqAvant = JSON.stringify(pg.state.invoiceSeq ?? {});
        if (f.invoices.length !== avant || JSON.stringify(f.invoiceSeq) !== seqAvant) clair = JSON.stringify({ ...pg, state: { ...pg.state, ...f } });
      }
    } catch {
      // Un des deux ne se lit pas : on garde le gagnant tel quel.
    }
  }
  if (fusion !== null) return { gagnant: clair === distant.clair ? "distant" : "locale", clair, fusion: true };
  return { gagnant: distantGagne ? "distant" : "locale", clair, fusion: false };
}

/**
 * La copie en ligne remplace celle de l'appareil : écrite scellée par le
 * coffre. Rend false si elle n'a pas pu l'être (plus de place sur l'appareil).
 */
async function adopterDistant(nom: Nom, d: Distant, clairD: string): Promise<boolean> {
  marquerARelire(nom);
  await coffre!.ecrire(nom, clairD);
  await notesFaites();
  if ((await coffre!.lire(nom)) !== clairD) {
    relu(nom);
    return false;
  }
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
  const clairL = simple ? null : await coffre.lire(nom);
  if (clairL === null) return adopterDistant(nom, d, clairD);
  const baseRaw = localStorage.getItem(cleBase(nom));
  const base = baseRaw ? await depuisDistant(baseRaw, (s) => coffre!.ouvrir(s)) : null;
  const choix = departager(nom, { clair: clairL, modifie: e.modifie, vu: e.vu }, { clair: clairD, modifie: d.modifie }, base);
  if (choix.gagnant === "distant") {
    // Sans fusion, la copie de l'appareil est gardée sur le serveur avant d'être remplacée.
    if (!choix.fusion && clairL !== clairD) {
      const contenu = await pourServeur(clairL);
      if (contenu) await appel("POST", { nom, contenu, rev: e.rev, modifie: e.modifie, appareil: appareil(), garder: true });
    }
    if (choix.clair === clairD) return adopterDistant(nom, d, clairD);
  }
  // L'appareil gagne, ou la copie gagnante reçoit des factures de l'autre : on l'écrit et on l'envoie.
  majTiroir(nom, { rev: d.rev, vu: true, empreinte: await empreinte(clairD) });
  garderBase(nom, estClair(d.contenu) ? d.contenu : ((await pourServeur(clairD)) ?? d.contenu));
  if (choix.clair !== clairL) {
    marquerARelire(nom);
    await coffre.ecrire(nom, choix.clair);
  }
  majTiroir(nom, { sale: true, locale: await empreinte(choix.clair), modifie: new Date().toISOString() });
  return choix.clair !== clairL;
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
      if (!toujours) planifierEnvoi();
    } else if (r.status === 409) {
      const changed = await resoudre(nom, (r.json.tiroir as Distant | null) ?? null);
      if (changed) notifier(new Set([nom]));
      planifierEnvoi(500);
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
  derniere = { quand: new Date().toISOString(), ok: !refuse };
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
 */
export async function synchroniser(): Promise<Set<string>> {
  const changes = new Set<string>();
  if (tropAncienPourCompte()) signalerTropAncien();
  if (!actif() || !coffre) return changes;
  if (enCours) {
    await enCours;
    return changes;
  }
  let fin!: () => void;
  enCours = new Promise((r) => (fin = r));
  try {
    const r = await appel("GET");
    if (r.status !== 200) {
      derniere = { quand: new Date().toISOString(), ok: false };
      return changes;
    }
    noterFormats(r.json.formats);
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
      if (e?.vu && d.rev < e.rev) {
        // Le serveur est revenu en arrière (restauration) : on le suit comme une version nouvelle.
        majTiroir(nom, { rev: d.rev });
      }
      // Rien d'attendu sur l'appareil : la copie en ligne remplace simplement.
      const simple = !raw || (!!e?.vu && !e.sale);
      if (await resoudre(nom, d, simple)) changes.add(nom);
    }
    tire = true;
    derniere = { quand: new Date().toISOString(), ok: true };
  } finally {
    enCours = null;
    fin();
  }
  if (changes.size) notifier(changes);
  await envoyer();
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
  if (e?.vu && d.rev < e.rev) majTiroir(nom, { rev: d.rev });
  const raw = localStorage.getItem(scopedKey(nom));
  const change = await resoudre(nom, d, !raw || (!!e?.vu && !e.sale));
  if (change) notifier(new Set([nom]));
  return { etat, change };
}

/** Envoie tout de suite ce qui attend (une facture vient d'être numérotée : l'autre appareil doit la voir vite). */
export async function envoyerMaintenant(): Promise<void> {
  if (!actif()) return;
  await notesFaites();
  await envoyer();
}

/** Où en est la copie en ligne, pour l'écran Mon compte. */
export function etatNuage(): { allume: boolean; attente: boolean; changements: number; aJour: string | null; derniere: { quand: string; ok: boolean } | null; refus: CodeRefus | null; tropAncien: boolean } {
  const e = lireEtat();
  const sales = TIROIRS.filter((n) => e[n]?.sale);
  const changements = sales.reduce((t, n) => t + Math.max(1, e[n]?.n ?? 1), 0);
  // À jour : le dernier envoi ou la dernière lecture réussis, ici ou gardés d'une visite d'avant.
  const dates = [derniere?.ok ? derniere.quand : null, ...TIROIRS.map((n) => e[n]?.aligne ?? null)].filter((d): d is string => !!d);
  const aJour = dates.length ? dates.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b)) : null;
  // tropAncien : la copie est éteinte sur ce navigateur, l'écran peut dire TEXTE_TROP_ANCIEN.
  return { allume: actif(), attente: sales.length > 0, changements, aJour, derniere, refus: refusCopie(), tropAncien: tropAncienPourCompte() };
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
  if (minuteur) clearTimeout(minuteur);
  minuteur = null;
}
