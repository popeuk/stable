// Les règles de la fonction « tiroirs », sans rien de Deno ni de Supabase :
// elles se testent dans l'app (tests/unit/sync/tiroirs-regles.test.ts).

/** Un envoi au plus 2 Mo : les vraies données d'une écurie font quelques dizaines de Ko. */
export const MAX = 2_000_000;
/** Le contenu arrive toujours chiffré par l'app (lib/account/vault.ts). */
export const PREFIXE = "bs-enc1:";
/** Versions gardées par compte et par tiroir (même nombre que le déclencheur de 0003_tiroirs.sql). */
export const VERSIONS = 30;
/** Un jeton vérifié auprès du site reste bon 2 minutes ici (après une déconnexion, il tombe vite). */
export const CACHE_OK_MS = 2 * 60_000;
/** Un jeton refusé par le site l'est encore 5 minutes, sans rappeler le site. */
export const CACHE_REFUS_MS = 5 * 60_000;

/**
 * Le jeton de mon-ecurie.fr : « <numéro du compte>.<64 caractères hexadécimaux> »
 * (pc-bestable, inc/jetons.php). Tout autre format est refusé sans appeler le site.
 */
export function jetonBienForme(t: string): boolean {
  return /^\d{1,12}\.[a-f0-9]{64}$/.test(t);
}

export function contenuChiffre(c: string): boolean {
  return c.startsWith(PREFIXE) && c.length > PREFIXE.length;
}

/** Un compteur à fenêtre glissante, en mémoire de l'instance : au-delà de `max` dans `ms`, refus. */
export class Fenetre {
  private coups = new Map<string, number[]>();
  constructor(
    private max: number,
    private ms: number,
    private taille = 10_000,
  ) {}
  /** Compte un coup pour `cle` et dit s'il dépasse la limite (un coup refusé ne compte pas). */
  depasse(cle: string, maintenant = Date.now()): boolean {
    const recents = (this.coups.get(cle) ?? []).filter((t) => maintenant - t < this.ms);
    if (recents.length >= this.max) {
      this.coups.set(cle, recents);
      return true;
    }
    recents.push(maintenant);
    this.coups.set(cle, recents);
    if (this.coups.size > this.taille) this.coups.clear();
    return false;
  }
}

/** Une petite mémoire à échéance (jetons bons, jetons refusés). */
export class Memoire<T> {
  private m = new Map<string, { v: T; jusqua: number }>();
  constructor(
    private ms: number,
    private taille = 5000,
  ) {}
  lire(cle: string, maintenant = Date.now()): T | undefined {
    const e = this.m.get(cle);
    if (!e) return undefined;
    if (e.jusqua <= maintenant) {
      this.m.delete(cle);
      return undefined;
    }
    return e.v;
  }
  poser(cle: string, v: T, maintenant = Date.now()) {
    if (this.m.size >= this.taille) this.m.clear();
    this.m.set(cle, { v, jusqua: maintenant + this.ms });
  }
}

/** Les identifiants des versions à retirer : tout ce qui dépasse les `VERSIONS` plus récentes. */
export function versionsEnTrop(ids: { id: number }[], garder = VERSIONS): number[] {
  return ids.slice(garder).map((x) => x.id);
}
