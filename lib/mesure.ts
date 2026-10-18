/**
 * La mesure d'audience (décision 12 du 18 octobre 2026) : Google Analytics
 * (GA4) pour l'audience, le pixel Meta pour la publicité.
 *
 * ÉTEINTE tant que les identifiants ne sont pas posés au moment de
 * construire l'app (NEXT_PUBLIC_GA_ID, NEXT_PUBLIC_META_PIXEL, vides par
 * défaut) : sans eux, rien ne se charge et le bandeau ne s'affiche pas.
 *
 * Avec eux, règles de la CNIL : rien n'est chargé avant l'accord ; refuser
 * est aussi simple qu'accepter ; le choix est gardé 6 mois puis redemandé ;
 * on change d'avis dans Réglages. Les événements d'avant l'accord sont
 * perdus, pas mis de côté.
 *
 * Aucun chiffre de l'écurie ne part : seulement le nom de l'étape franchie.
 */

export const GA_ID = (process.env.NEXT_PUBLIC_GA_ID ?? "").trim();
export const META_PIXEL = (process.env.NEXT_PUBLIC_META_PIXEL ?? "").trim();

/** Un identifiant mal formé est ignoré : il ne doit jamais finir dans une adresse de script. */
export const gaValide = (id: string) => /^G-[A-Z0-9]{4,20}$/.test(id);
export const pixelValide = (id: string) => /^\d{6,20}$/.test(id);

export const AVEC_GA = gaValide(GA_ID);
export const AVEC_PIXEL = pixelValide(META_PIXEL);
/** Au moins un outil est posé : le bandeau a lieu d'être. */
export const MESURE_POSEE = AVEC_GA || AVEC_PIXEL;

/**
 * Les adresses à autoriser dans la politique de contenu le jour où les
 * identifiants sont posés (deploiement/vps/caddy-app.txt). Gardées ici pour
 * que le code et l'en-tête disent la même chose.
 */
export const ADRESSES_MESURE = {
  script: ["https://www.googletagmanager.com", "https://connect.facebook.net"],
  connect: ["https://www.google-analytics.com", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://www.googletagmanager.com", "https://www.facebook.com", "https://connect.facebook.net"],
  img: ["https://www.google-analytics.com", "https://*.google-analytics.com", "https://www.googletagmanager.com", "https://www.facebook.com"],
} as const;

/** Les étapes mesurées. */
export type Evenement = "histoire_vue" | "questions_finies" | "voila_ton_mois" | "compte_cree" | "premiere_saisie" | "facture_faite";

/** Le nom standard de Meta quand il existe (sinon un événement personnalisé). */
const META_STANDARD: Partial<Record<Evenement, string>> = { compte_cree: "CompleteRegistration" };

export interface Choix {
  /** Mesure d'audience (Google Analytics). */
  audience: boolean;
  /** Publicité (pixel Meta). */
  pub: boolean;
  /** Quand le choix a été fait (ISO). */
  quand: string;
}

export const CLE_CHOIX = "bs-consentement";
/** 6 mois : au-delà, on redemande. */
export const DUREE_CHOIX_MS = 182 * 24 * 3600 * 1000;

/** Un choix lu sur l'appareil, encore valable, ou null (il faut demander). */
export function choixValable(brut: string | null, maintenant = Date.now()): Choix | null {
  if (!brut) return null;
  try {
    const c = JSON.parse(brut) as Partial<Choix>;
    const t = Date.parse(String(c.quand ?? ""));
    if (typeof c.audience !== "boolean" || typeof c.pub !== "boolean" || !Number.isFinite(t)) return null;
    if (maintenant - t >= DUREE_CHOIX_MS || t - maintenant > 24 * 3600 * 1000) return null;
    return { audience: c.audience, pub: c.pub, quand: c.quand as string };
  } catch {
    return null;
  }
}

export function lireChoix(): Choix | null {
  try {
    return choixValable(localStorage.getItem(CLE_CHOIX));
  } catch {
    return null;
  }
}

/* ---------- Le chargement, seulement après l'accord ---------- */

type Fenetre = Window & {
  dataLayer?: unknown[];
  gtag?: (...a: unknown[]) => void;
  fbq?: ((...a: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: (...a: unknown[]) => void; push?: unknown };
  _fbq?: unknown;
};

let gaCharge = false;
let pixelCharge = false;

function script(src: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function chargerGa() {
  if (gaCharge || !AVEC_GA) return;
  gaCharge = true;
  const w = window as Fenetre;
  w.dataLayer = w.dataLayer ?? [];
  w.gtag = function gtag() {
    // gtag attend l'objet « arguments » lui-même.
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  w.gtag("js", new Date());
  // Pas de signaux publicitaires Google, adresse IP tronquée côté Google (GA4 par défaut).
  w.gtag("config", GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
  script(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`);
}

function chargerPixel() {
  if (pixelCharge || !AVEC_PIXEL) return;
  pixelCharge = true;
  const w = window as Fenetre;
  if (!w.fbq) {
    const f = function (...a: unknown[]) {
      if (f.callMethod) f.callMethod(...a);
      else f.queue!.push(a);
    } as NonNullable<Fenetre["fbq"]>;
    f.push = f;
    f.loaded = true;
    f.version = "2.0";
    f.queue = [];
    w.fbq = f;
    w._fbq = f;
  }
  w.fbq("init", META_PIXEL);
  w.fbq("track", "PageView");
  script("https://connect.facebook.net/fr_FR/fbevents.js");
}

/** Charge ce que le choix autorise (et rien d'autre). */
export function appliquerChoix(c: Choix | null) {
  if (typeof window === "undefined" || !c) return;
  if (c.audience) chargerGa();
  if (c.pub) chargerPixel();
}

/** Les témoins déjà posés par ces outils, à retirer quand on refuse après avoir accepté. */
function retirerTemoins() {
  const noms = document.cookie.split(";").map((x) => x.split("=")[0].trim());
  const domaines = ["", location.hostname, `.${location.hostname.split(".").slice(-2).join(".")}`];
  for (const n of noms) {
    if (!/^(_ga|_gid|_gat|_fbp|_fbc)/.test(n)) continue;
    for (const d of domaines) document.cookie = `${n}=; Max-Age=0; path=/${d ? `; domain=${d}` : ""}`;
  }
}

/** Garde le choix pour 6 mois et l'applique. Un retrait après un accord recharge la page : les scripts partent. */
export function enregistrerChoix(audience: boolean, pub: boolean) {
  const c: Choix = { audience, pub, quand: new Date().toISOString() };
  try {
    localStorage.setItem(CLE_CHOIX, JSON.stringify(c));
  } catch {}
  const retrait = (gaCharge && !audience) || (pixelCharge && !pub);
  if (retrait) {
    retirerTemoins();
    location.reload();
    return c;
  }
  if (!audience || !pub) retirerTemoins();
  appliquerChoix(c);
  return c;
}

/** Note une étape franchie, si l'outil est chargé (donc accepté). Sinon, rien. */
export function mesurer(e: Evenement) {
  if (typeof window === "undefined" || !MESURE_POSEE) return;
  const w = window as Fenetre;
  try {
    if (gaCharge) w.gtag?.("event", e);
    if (pixelCharge) {
      const std = META_STANDARD[e];
      if (std) w.fbq?.("track", std);
      else w.fbq?.("trackCustom", e);
    }
  } catch {}
}

/** Une étape qui ne se compte qu'une fois par appareil (première saisie, questions finies…). */
export function mesurerUneFois(e: Evenement) {
  if (!MESURE_POSEE || !(gaCharge || pixelCharge)) return;
  try {
    const k = `bs-mesure-${e}`;
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
  } catch {}
  mesurer(e);
}

/** Rouvre le panneau des choix (depuis Réglages). */
export const OUVRIR_CHOIX = "bs-consentement-ouvrir";
export function ouvrirChoix() {
  window.dispatchEvent(new Event(OUVRIR_CHOIX));
}
