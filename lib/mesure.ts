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
 * Ni aucun nom de client (audit sécurité N1) : les adresses des écrans n'en
 * contiennent plus (lib/adresse-client), et Google ne reçoit que l'adresse
 * sans sa recherche (`?…`) avec un titre fixe. Meta : pas de collecte
 * automatique (autoConfig coupé, changements d'écran non suivis), seulement
 * les étapes de `mesurer()`.
 *
 * Le jour de l'allumage, dans les consoles : GA, « mesure améliorée » sans
 * les changements d'historique, conservation 14 mois au plus ; Meta,
 * correspondance avancée automatique désactivée.
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
 * identifiants sont posés : elles n'y sont PAS tant que la mesure est
 * éteinte (deploiement/vps/caddy-app.txt dit quoi ajouter). Gardées ici pour
 * que le code et l'en-tête disent la même chose.
 */
export const ADRESSES_MESURE = {
  script: ["https://www.googletagmanager.com", "https://connect.facebook.net"],
  connect: ["https://www.google-analytics.com", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://www.googletagmanager.com", "https://www.facebook.com", "https://connect.facebook.net"],
  img: ["https://www.google-analytics.com", "https://*.google-analytics.com", "https://www.googletagmanager.com", "https://www.facebook.com"],
} as const;

/** Les témoins de Google : 13 mois au plus (CNIL), au lieu de 2 ans par défaut. */
export const DUREE_TEMOINS_S = 34_164_000;
/** Le seul titre de page envoyé : jamais celui de l'écran (il peut porter un nom). */
export const TITRE_MESURE = "Be Stable";

/** L'adresse de la page telle qu'elle part chez Google : sans la recherche ni l'ancre. */
export function adresseMesuree(l: { origin: string; pathname: string } = location): string {
  return l.origin + l.pathname;
}

/** Les réglages de GA4 : pas de page vue automatique, pas de signaux publicitaires, témoins 13 mois. */
export function reglagesGa(l?: { origin: string; pathname: string }) {
  return {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_expires: DUREE_TEMOINS_S,
    page_location: adresseMesuree(l),
    page_title: TITRE_MESURE,
  };
}

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
  // Pas de signaux publicitaires Google, adresse IP tronquée côté Google (GA4 par défaut),
  // et une seule page vue, envoyée à la main avec l'adresse nettoyée.
  const r = reglagesGa();
  w.gtag("config", GA_ID, r);
  w.gtag("event", "page_view", { page_location: r.page_location, page_title: r.page_title });
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
  // Pas de collecte automatique (texte des boutons, champs des formulaires), pas de suivi des changements d'écran.
  (w.fbq as { disablePushState?: boolean }).disablePushState = true;
  w.fbq("set", "autoConfig", false, META_PIXEL);
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
    if (gaCharge) w.gtag?.("event", e, { page_location: adresseMesuree(), page_title: TITRE_MESURE });
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
