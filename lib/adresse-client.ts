/**
 * Les adresses des écrans d'un client sans son nom dedans (audit sécurité
 * N1, 19 octobre 2026). Avant : `/client?nom=Mme Dupont`, et ce nom serait
 * parti chez Google et Meta avec l'adresse de la page le jour où la mesure
 * est allumée. Maintenant : `/client?c=k3x9a1b2`, un identifiant tiré du nom
 * avec une graine propre à l'appareil (sans elle, on ne retrouve pas le nom).
 *
 * L'écran retrouve le nom parmi ceux du carnet (personnes, propriétaires,
 * recettes, factures, paiements). Un nom tout neuf, pas encore dans le
 * carnet (« + Nouveau » propriétaire), est gardé en mémoire le temps de la
 * navigation. Les anciennes adresses (`?nom=`, `?proprietaire=`) marchent
 * toujours.
 */

const GRAINE = "bs-graine-adresses";
let graine: number | null = null;

function graineAppareil(): number {
  if (graine !== null) return graine;
  let g = 0;
  try {
    const lu = Number(localStorage.getItem(GRAINE));
    if (Number.isInteger(lu) && lu > 0) g = lu;
    else {
      g = (crypto.getRandomValues(new Uint32Array(1))[0] || 1) >>> 0;
      localStorage.setItem(GRAINE, String(g));
    }
  } catch {
    g = (Math.random() * 0xffffffff) >>> 0 || 1;
  }
  graine = g;
  return g;
}

/** cyrb53 : une empreinte rapide sur 53 bits, avec la graine de l'appareil. */
function empreinte(s: string, seed: number): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Les noms vus pendant cette navigation, par identifiant (jamais rangés sur l'appareil). */
const vus = new Map<string, string>();
const deja = new Map<string, string>();

/** L'identifiant d'un nom sur cet appareil. */
export function idDuNom(nom: string): string {
  let id = deja.get(nom);
  if (!id) {
    id = empreinte(nom, graineAppareil());
    deja.set(nom, id);
  }
  return id;
}

const retenir = (nom: string) => {
  const id = idDuNom(nom);
  vus.set(id, nom);
  return id;
};

/** La fiche d'un client, d'un mois s'il est donné. */
export const adresseClient = (nom: string, mois?: string) => `/client?c=${retenir(nom)}${mois ? `&mois=${mois}` : ""}`;
/** La facture d'un client pour un mois. */
export const adresseFacture = (nom: string, mois: string) => `/facture?c=${retenir(nom)}&mois=${mois}`;
/** Ajouter un cheval à ce propriétaire (formulaire de l'app ou du parcours), et revenir où l'on dit. */
export const adresseChevalDe = (base: "/saisie/cheval" | "/parcours/chevaux", nom: string, retour?: string) => `${base}?c=${retenir(nom)}${retour ? `&retour=${encodeURIComponent(retour)}` : ""}`;

interface Carnet {
  people?: { name: string }[];
  horses?: { ownerName?: string }[];
  revenues?: { payer?: string }[];
  invoices?: { payer: string }[];
  payments?: { payer: string }[];
}

/** Le nom derrière un identifiant, cherché dans le carnet ; "" s'il n'y est pas. */
export function nomDuCarnet(id: string, carnet: Carnet): string {
  const v = vus.get(id);
  if (v !== undefined) return v;
  const essayer = (n: string | undefined) => !!n && idDuNom(n) === id;
  for (const p of carnet.people ?? []) if (essayer(p.name)) return p.name;
  for (const h of carnet.horses ?? []) {
    if (essayer(h.ownerName)) return h.ownerName!;
    if (essayer(h.ownerName?.trim())) return h.ownerName!.trim();
  }
  for (const i of carnet.invoices ?? []) if (essayer(i.payer)) return i.payer;
  for (const p of carnet.payments ?? []) if (essayer(p.payer)) return p.payer;
  for (const r of carnet.revenues ?? []) if (essayer(r.payer)) return r.payer!;
  return "";
}

/**
 * Le nom demandé par l'adresse : `?c=` (cherché dans le carnet), ou l'ancien
 * paramètre en clair (`?nom=`, `?proprietaire=`) pour les adresses d'avant.
 */
export function nomDeLAdresse(sp: { get(k: string): string | null }, carnet: Carnet, ancien = "nom"): string {
  const enClair = sp.get(ancien);
  if (enClair !== null) return enClair;
  const c = sp.get("c");
  return c ? nomDuCarnet(c, carnet) : "";
}

/** Pour les tests. */
export function _oublierAdresses() {
  vus.clear();
  deja.clear();
  graine = null;
}
