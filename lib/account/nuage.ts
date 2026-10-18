"use client";

import { getSession, scopedKey } from "@/lib/account/session";
import { fusionFactures } from "@/lib/domain/facture";
import { fusionner3 } from "@/lib/account/fusion";
import type { StableData } from "@/lib/domain/types";
import { estPlacePleine, noterPlacePleine } from "@/lib/account/place";

/**
 * La copie en ligne des tiroirs d'un compte (Supabase, projet `bestable`).
 *
 * Ce qui part est exactement ce qui est rangé sur l'appareil : déjà chiffré
 * avec la clé du compte (lib/account/vault). Le serveur ne lit rien ; il
 * garde la dernière version de chaque tiroir et les 30 précédentes.
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
}
let coffre: Coffre | null = null;
export function brancherCoffre(c: Coffre) {
  coffre = c;
}

let tire = false;
let minuteur: ReturnType<typeof setTimeout> | null = null;
let enCours: Promise<void> | null = null;
let derniere: { quand: string; ok: boolean } | null = null;

export function nuageAllume(): boolean {
  try {
    return localStorage.getItem(DRAPEAU) !== "0";
  } catch {
    return false;
  }
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

function actif(): boolean {
  return getSession()?.kind === "compte" && nuageAllume();
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
 * La dernière version commune avec le serveur, telle qu'elle est rangée
 * (chiffrée) : c'est la base de la fusion quand les deux côtés ont changé.
 */
const cleBase = (nom: Nom) => scopedKey(`bs-nuage-base:${nom}`);
function garderBase(nom: Nom, raw: string) {
  try {
    localStorage.setItem(cleBase(nom), raw);
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
  const stop = new AbortController();
  const t = setTimeout(() => stop.abort(), 30000);
  try {
    const res = await fetch(NUAGE_URL, {
      method,
      headers: { "X-BS-Token": s.token, ...(body ? { "Content-Type": "application/json" } : {}) },
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

/** Le serveur a une version que l'appareil n'a pas : on l'aligne. Rend true si l'appareil a changé. */
async function resoudre(nom: Nom, d: Distant | null, simple = false): Promise<boolean> {
  if (!coffre) return false;
  if (!d) {
    // Le serveur n'a plus rien : on renvoie tout.
    majTiroir(nom, { rev: 0, sale: true });
    return false;
  }
  const e = lireEtat()[nom] ?? { rev: 0 };
  const clairD = await coffre.ouvrir(d.contenu);
  if (clairD === null) {
    // Illisible avec la clé de ce compte : on ne touche pas à l'appareil, et on le renvoie.
    majTiroir(nom, { rev: d.rev, sale: true, vu: true });
    return false;
  }
  const clairL = simple ? null : await coffre.lire(nom);
  if (clairL === null) {
    marquerARelire(nom);
    try {
      localStorage.setItem(scopedKey(nom), d.contenu);
    } catch (err) {
      if (estPlacePleine(err)) noterPlacePleine();
      relu(nom);
      return false;
    }
    garderBase(nom, d.contenu);
    const h = await empreinte(clairD);
    majTiroir(nom, { rev: d.rev, empreinte: h, locale: h, sale: false, vu: true, modifie: d.modifie });
    return true;
  }
  const baseRaw = localStorage.getItem(cleBase(nom));
  const base = baseRaw ? await coffre.ouvrir(baseRaw) : null;
  const choix = departager(nom, { clair: clairL, modifie: e.modifie, vu: e.vu }, { clair: clairD, modifie: d.modifie }, base);
  if (choix.gagnant === "distant") {
    // Sans fusion, la copie de l'appareil est gardée sur le serveur avant d'être remplacée.
    if (!choix.fusion && clairL !== clairD) {
      const raw = localStorage.getItem(scopedKey(nom));
      if (raw) await appel("POST", { nom, contenu: raw, rev: e.rev, modifie: e.modifie, appareil: appareil(), garder: true });
    }
    if (choix.clair === clairD) {
      marquerARelire(nom);
      try {
        localStorage.setItem(scopedKey(nom), d.contenu);
      } catch (err) {
        if (estPlacePleine(err)) noterPlacePleine();
        relu(nom);
        return false;
      }
      garderBase(nom, d.contenu);
      const h = await empreinte(clairD);
      majTiroir(nom, { rev: d.rev, empreinte: h, locale: h, sale: false, vu: true, modifie: d.modifie });
      return true;
    }
  }
  // L'appareil gagne, ou la copie gagnante reçoit des factures de l'autre : on l'écrit et on l'envoie.
  majTiroir(nom, { rev: d.rev, vu: true, empreinte: await empreinte(clairD) });
  garderBase(nom, d.contenu);
  if (choix.clair !== clairL) {
    marquerARelire(nom);
    await coffre.ecrire(nom, choix.clair);
  }
  majTiroir(nom, { sale: true, locale: await empreinte(choix.clair), modifie: new Date().toISOString() });
  return choix.clair !== clairL;
}

/** Envoie ce qui attend. */
export async function envoyer(): Promise<void> {
  if (!actif() || !tire) return;
  for (const nom of TIROIRS) {
    const e = lireEtat()[nom];
    if (!e?.sale) continue;
    const raw = localStorage.getItem(scopedKey(nom));
    if (!raw) continue;
    const envoye = e.locale;
    const r = await appel("PUT", { nom, contenu: raw, rev: e.rev, modifie: e.modifie ?? new Date().toISOString(), appareil: appareil() });
    if (r.status === 200 && typeof r.json.rev === "number") {
      garderBase(nom, raw);
      const now = lireEtat()[nom];
      const toujours = now?.locale === envoye;
      majTiroir(nom, { rev: r.json.rev, vu: true, ...(toujours ? { sale: false, empreinte: envoye, n: 0, aligne: new Date().toISOString() } : {}) });
      if (!toujours) planifierEnvoi();
    } else if (r.status === 409) {
      const changed = await resoudre(nom, (r.json.tiroir as Distant | null) ?? null);
      if (changed) notifier(new Set([nom]));
      planifierEnvoi(500);
    } else {
      derniere = { quand: new Date().toISOString(), ok: false };
      if (r.status !== 401) planifierEnvoi(60000);
      return;
    }
  }
  derniere = { quand: new Date().toISOString(), ok: true };
}

/**
 * Lit le serveur et aligne l'appareil. Rend les tiroirs qui ont changé sur
 * l'appareil (il faut alors relire les données à l'écran).
 */
export async function synchroniser(): Promise<Set<string>> {
  const changes = new Set<string>();
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
    const distants = new Map(((r.json.tiroirs ?? []) as Distant[]).map((d) => [d.nom, d]));
    for (const nom of TIROIRS) {
      const d = distants.get(nom);
      const e = lireEtat()[nom];
      const raw = localStorage.getItem(scopedKey(nom));
      if (!d) {
        if (raw) majTiroir(nom, { rev: 0, sale: true, modifie: e?.modifie ?? new Date().toISOString() });
        continue;
      }
      if (e?.vu && d.rev === e.rev) continue;
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

/** Où en est la copie en ligne, pour l'écran Mon compte. */
export function etatNuage(): { allume: boolean; attente: boolean; changements: number; aJour: string | null; derniere: { quand: string; ok: boolean } | null } {
  const e = lireEtat();
  const sales = TIROIRS.filter((n) => e[n]?.sale);
  const changements = sales.reduce((t, n) => t + Math.max(1, e[n]?.n ?? 1), 0);
  // À jour : le dernier envoi ou la dernière lecture réussis, ici ou gardés d'une visite d'avant.
  const dates = [derniere?.ok ? derniere.quand : null, ...TIROIRS.map((n) => e[n]?.aligne ?? null)].filter((d): d is string => !!d);
  const aJour = dates.length ? dates.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b)) : null;
  return { allume: actif(), attente: sales.length > 0, changements, aJour, derniere };
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
  if (minuteur) clearTimeout(minuteur);
  minuteur = null;
}
