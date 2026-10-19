/**
 * Le suivi des erreurs (audit technique I1) : quand l'app plante chez un
 * gérant, Samuel le sait. Une erreur de JavaScript (window.onerror), une
 * promesse rejetée sans suite (unhandledrejection) ou un écran d'erreur
 * envoient à mon-ecurie.fr (pc-bestable 1.5.1, POST erreurs) quatre choses
 * seulement : le message, l'écran (son chemin, sans la recherche), la
 * version de l'app et le navigateur. Le site les range et prévient Samuel
 * au-delà de 20 par heure.
 *
 * Jamais une donnée de l'écurie : le message est nettoyé (ce qui est entre
 * guillemets, les adresses e-mail, les nombres longs disparaissent) et coupé
 * à 300 caractères. Tant que le site n'a pas la route (404), plus rien ne
 * part pendant un jour : on ne voit rien, rien ne s'affiche.
 */

export type Sorte = "erreur" | "promesse" | "ecran" | "copie";

export interface Rapport {
  type: Sorte;
  message: string;
  ecran: string;
  version: string;
  navigateur: string;
}

const VERSION = (process.env.NEXT_PUBLIC_VERSION ?? "").slice(0, 12) || "dev";
const ARRET = "bs-erreurs-sans-route";
/** Au plus 10 envois par chargement de page, et le même message une fois. */
const MAX_PAR_PAGE = 10;
let envoyes = 0;
const vus = new Set<string>();

/** Le message sans rien qui puisse venir de l'écurie (noms, montants, adresses). */
export function nettoyerMessage(m: string): string {
  return m
    .replace(/"[^"]*"|'[^']*'|«[^»]*»|“[^”]*”|‘[^’]*’|`[^`]*`/g, "«…»")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "«e-mail»")
    .replace(/\d[\d\s.,]{3,}\d/g, "«nombre»")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** L'écran, sans sa recherche ni son ancre (pas d'identifiant, pas de nom). */
export function ecranSeul(chemin: string): string {
  return chemin.split(/[?#]/)[0].slice(0, 120) || "/";
}

export function rapport(type: Sorte, erreur: unknown, chemin: string, navigateur: string): Rapport {
  const brut = erreur instanceof Error ? `${erreur.name}: ${erreur.message}` : typeof erreur === "string" ? erreur : erreur && typeof erreur === "object" && "message" in erreur ? String((erreur as { message: unknown }).message) : String(erreur ?? "");
  return { type, message: nettoyerMessage(brut) || "(sans message)", ecran: ecranSeul(chemin), version: VERSION, navigateur: navigateur.slice(0, 300) };
}

/** Le bruit des navigateurs, qui ne dit rien de l'app. */
export function aIgnorer(message: string): boolean {
  return /ResizeObserver loop|Script error\.?$|^\(sans message\)$/i.test(message);
}

type Envoi = (url: string, corps: string) => Promise<number>;
const parFetch: Envoi = async (url, corps) => {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: corps, credentials: "omit", keepalive: true });
  return r.status;
};

function arrete(maintenant: number): boolean {
  try {
    const t = Number(localStorage.getItem(ARRET) ?? 0);
    return !!t && maintenant - t < 24 * 3600_000;
  } catch {
    return false;
  }
}

/**
 * Envoie une erreur (une fois par message, dix par page au plus). Rend true
 * si elle est partie. `envoi` et `api` servent aux tests.
 */
export async function signalerErreur(type: Sorte, erreur: unknown, o: { chemin?: string; navigateur?: string; api?: string; envoi?: Envoi; maintenant?: number } = {}): Promise<boolean> {
  const maintenant = o.maintenant ?? Date.now();
  const chemin = o.chemin ?? (typeof location !== "undefined" ? location.pathname : "/");
  const nav = o.navigateur ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  const r = rapport(type, erreur, chemin, nav);
  if (aIgnorer(r.message) || arrete(maintenant)) return false;
  const cle = `${r.type}|${r.message}|${r.ecran}`;
  if (vus.has(cle) || envoyes >= MAX_PAR_PAGE) return false;
  vus.add(cle);
  envoyes++;
  const api = o.api ?? (process.env.NEXT_PUBLIC_MONECURIE_API ?? "https://www.mon-ecurie.fr/wp-json/bestable/v1").replace(/\/$/, "");
  try {
    const status = await (o.envoi ?? parFetch)(`${api}/erreurs`, JSON.stringify(r));
    if (status === 404) {
      // Le site n'a pas encore la route : on se tait un jour.
      try {
        localStorage.setItem(ARRET, String(maintenant));
      } catch {}
      return false;
    }
    return status >= 200 && status < 300;
  } catch {
    return false;
  }
}

/** Branche window.onerror et unhandledrejection (une fois). Rend la fonction qui les retire. */
export function brancherSuivi(): () => void {
  if (typeof window === "undefined") return () => {};
  const surErreur = (e: ErrorEvent) => {
    // Une erreur d'un script d'ailleurs (extension du navigateur) : pas la nôtre.
    if (e.filename && !e.filename.startsWith(location.origin)) return;
    void signalerErreur("erreur", e.error ?? e.message);
  };
  const surPromesse = (e: PromiseRejectionEvent) => void signalerErreur("promesse", e.reason);
  window.addEventListener("error", surErreur);
  window.addEventListener("unhandledrejection", surPromesse);
  return () => {
    window.removeEventListener("error", surErreur);
    window.removeEventListener("unhandledrejection", surPromesse);
  };
}

/** Pour les tests. */
export function _reinitialiserSuivi() {
  envoyes = 0;
  vus.clear();
}
