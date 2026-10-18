/**
 * La place de Be Stable sur l'appareil. Tout est rangé dans le localStorage
 * du navigateur (environ 5 Mo par site, parfois moins sur Safari). Quand il
 * est plein, l'écriture est refusée (QuotaExceededError) : avant, l'erreur
 * se perdait et la saisie disparaissait au rechargement. Ici, chaque
 * écriture passe par `ranger`, qui attrape le refus et le dit tout de suite
 * (bandeau qui reste, components/bs/place-bandeau.tsx). On mesure aussi la
 * place prise, pour prévenir doucement dès 70 %.
 */

/** La limite qu'on prend pour repère : environ 5 Mo (comptés en caractères, comme le navigateur). */
export const LIMITE_PLACE = 5_000_000;
export const SEUIL_PROCHE = 0.7;

export interface EtatPlace {
  /** La dernière écriture a été refusée faute de place. */
  plein: boolean;
  /** Depuis quand rien n'est enregistré (la dernière écriture réussie, en ms), si on le sait. */
  depuis: number | null;
  /** La part de la place prise (0 à 1), à la dernière mesure. */
  part: number;
}

let etat: EtatPlace = { plein: false, depuis: null, part: 0 };
let derniereReussite: number | null = null;
let derniereMesure = 0;
const ecoutes = new Set<() => void>();

function poser(e: EtatPlace) {
  if (e.plein === etat.plein && e.depuis === etat.depuis && e.part === etat.part) return;
  etat = e;
  for (const f of ecoutes) f();
}

/** Le navigateur refuse d'écrire faute de place (selon les navigateurs, le nom ou le code change). */
export function estPlacePleine(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const x = e as { name?: unknown; code?: unknown };
  return x.name === "QuotaExceededError" || x.name === "NS_ERROR_DOM_QUOTA_REACHED" || x.code === 22 || x.code === 1014;
}

type Rangement = Pick<Storage, "setItem" | "getItem" | "key" | "length">;
const local = (): Rangement | null => {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
};

/** La place prise par tout ce qui est rangé (clés et contenus, en caractères). */
export function mesurerPlace(r: Rangement | null = local()): number {
  if (!r) return 0;
  let n = 0;
  try {
    for (let i = 0; i < r.length; i++) {
      const k = r.key(i);
      if (k === null) continue;
      n += k.length + (r.getItem(k)?.length ?? 0);
    }
  } catch {
    return 0;
  }
  return n;
}

/** L'écriture a été refusée faute de place : on le retient (et le bandeau le dit). */
export function noterPlacePleine(maintenant = Date.now()) {
  poser({ ...etat, plein: true, depuis: derniereReussite ?? etat.depuis ?? maintenant });
}

/** Une écriture vient de passer : plus de souci de place, et on remesure de temps en temps. */
export function noterRangement(r: Rangement | null = local(), maintenant = Date.now(), forcer = false) {
  derniereReussite = maintenant;
  let part = etat.part;
  if (forcer || maintenant - derniereMesure > 30_000) {
    derniereMesure = maintenant;
    part = Math.min(1, mesurerPlace(r) / LIMITE_PLACE);
  }
  poser({ plein: false, depuis: null, part });
}

/**
 * Écrit dans le localStorage. Rend false si la place manque (et le note) ;
 * toute autre erreur est relancée.
 */
export function ranger(cle: string, valeur: string, r: Rangement | null = local()): boolean {
  if (!r) return false;
  try {
    r.setItem(cle, valeur);
  } catch (e) {
    if (estPlacePleine(e)) {
      noterPlacePleine();
      return false;
    }
    throw e;
  }
  noterRangement(r);
  return true;
}

export function etatPlace(): EtatPlace {
  return etat;
}
export function ecouterPlace(f: () => void) {
  ecoutes.add(f);
  return () => {
    ecoutes.delete(f);
  };
}

/** « 10 h 42 » ; un autre jour : « le 18 octobre à 10 h 42 ». */
export function heureDepuis(ms: number, maintenant = Date.now()): string {
  const d = new Date(ms);
  const h = `${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`;
  if (new Date(maintenant).toDateString() === d.toDateString()) return h;
  return `le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à ${h}`;
}

/** Ce que dit le bandeau, ou rien. */
export function messagePlace(e: EtatPlace, cetAppareil: string, maintenant = Date.now()): { fort: boolean; texte: string } | null {
  const nom = cetAppareil.replace(/^cet?\s+/, "ton ");
  if (e.plein) {
    const depuis = e.depuis !== null ? ` Rien n’est enregistré depuis ${heureDepuis(e.depuis, maintenant)}.` : " Ce que tu notes n’est plus enregistré.";
    return { fort: true, texte: `${nom[0].toUpperCase()}${nom.slice(1)} n’a plus de place pour Be Stable.${depuis}` };
  }
  if (e.part >= SEUIL_PROCHE) return { fort: false, texte: `La place de Be Stable sur ${cetAppareil} se remplit. Garde une sauvegarde de temps en temps (Réglages, Avancé).` };
  return null;
}

/** Demande au navigateur de ne pas vider ce qui est rangé quand il manque de place. */
export function demanderPersistance() {
  try {
    const st = typeof navigator !== "undefined" ? navigator.storage : undefined;
    if (st && typeof st.persist === "function") void st.persist().catch(() => {});
  } catch {}
}

/** Pour les tests. */
export function _reinitialiserPlace() {
  etat = { plein: false, depuis: null, part: 0 };
  derniereReussite = null;
  derniereMesure = 0;
}
