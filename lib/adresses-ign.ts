/**
 * Les adresses proposées pendant la frappe, prises dans la Base Adresse
 * Nationale par le service de l'IGN (Géoplateforme, gratuit, sans clé).
 * Seul ce qui est tapé dans un champ d'adresse part chez l'IGN, après une
 * courte pause dans la frappe, jamais le nom de la personne.
 * Le champ : components/bs/champ-adresse.tsx. La politique de contenu du VPS
 * autorise https://data.geopf.fr en connect-src (deploiement/vps/caddy-app.txt).
 */

export const IGN_GEOCODAGE = "https://data.geopf.fr/geocodage/search";

/** Le service refuse moins de 3 caractères et plus de 200. */
const MIN = 3;
const MAX = 200;

export type Suggestion = {
  /** Ex. « 12 Chemin des Prés » ; vide pour une commune seule. */
  rue: string;
  /** Ex. « 72000 Le Mans ». */
  commune: string;
  codePostal: string;
  ville: string;
  /** Le point GPS : [longitude, latitude]. */
  point?: [number, number];
};

/** Ce qu'on demande : le texte du champ sur une ligne, sans espaces en trop. */
export function requeteDe(texte: string): string {
  return texte.replace(/\s+/g, " ").trim().slice(0, MAX);
}

/** Assez de lettres pour chercher (au moins 3, dont une lettre ou un chiffre). */
export function assezPourChercher(texte: string): boolean {
  const q = requeteDe(texte);
  return q.length >= MIN && /[\p{L}\d]/u.test(q);
}

/** L'adresse de recherche. `communes` : seulement des communes (code postal et ville). */
export function urlRecherche(texte: string, { limite = 5, communes = false }: { limite?: number; communes?: boolean } = {}): string {
  const p = new URLSearchParams({ q: requeteDe(texte), limit: String(limite), autocomplete: "1", index: "address" });
  if (communes) p.set("type", "municipality");
  return `${IGN_GEOCODAGE}?${p}`;
}

type Feature = {
  geometry?: { coordinates?: [number, number] };
  properties?: { type?: string; name?: string; postcode?: string; city?: string; label?: string };
};

/** La réponse du service en suggestions, sans doublon. */
export function lireReponse(json: unknown): Suggestion[] {
  const features = (json as { features?: Feature[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const vues = new Set<string>();
  const out: Suggestion[] = [];
  for (const f of features) {
    const p = f?.properties;
    if (!p?.city) continue;
    const codePostal = p.postcode ?? "";
    const ville = p.city;
    const rue = p.type === "municipality" ? "" : (p.name ?? "").trim();
    const commune = [codePostal, ville].filter(Boolean).join(" ");
    const cle = `${rue}|${commune}`.toLowerCase();
    if (vues.has(cle)) continue;
    vues.add(cle);
    const c = f.geometry?.coordinates;
    out.push({ rue, commune, codePostal, ville, point: Array.isArray(c) && c.length === 2 ? [c[0], c[1]] : undefined });
  }
  return out;
}

/** L'adresse écrite dans le champ : sur deux lignes (factures, registre) ou sur une. */
export function adresseEcrite(s: Suggestion, surUneLigne = false): string {
  if (!s.rue) return s.commune;
  return surUneLigne ? `${s.rue}, ${s.commune}` : `${s.rue}\n${s.commune}`;
}

/** Cherche les adresses ; une liste vide si le réseau ou le service ne répond pas. */
export async function chercherAdresses(texte: string, opts: { signal?: AbortSignal; limite?: number; communes?: boolean } = {}): Promise<Suggestion[]> {
  if (!assezPourChercher(texte)) return [];
  try {
    const res = await fetch(urlRecherche(texte, opts), { signal: opts.signal, credentials: "omit", referrerPolicy: "no-referrer" });
    if (!res.ok) return [];
    return lireReponse(await res.json());
  } catch {
    return [];
  }
}
