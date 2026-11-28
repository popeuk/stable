import { heureDepuis } from "@/lib/account/place";
import { etatBrut, TEXTE_TROP_ANCIEN, TIROIRS, type CodeRefus } from "@/lib/account/nuage";

/** Le serveur refuse la copie : trop grosse (413) ou mal formée (400). */
export type RefusCopie = "trop_gros" | "invalide" | null;

/** La phrase du refus, pour Mon compte et le bandeau (la même partout). */
export function texteRefus(refus: RefusCopie): string | null {
  if (refus === "trop_gros") return "Ta copie en ligne ne part plus : ton écurie est trop grosse. Fais une sauvegarde, puis écris-nous : on la fera repartir.";
  if (refus === "invalide") return "Ta copie en ligne ne part plus. Fais une sauvegarde et écris-nous.";
  return null;
}

/**
 * Où en est la copie en ligne, pour l'écran Mon compte. Sorti de
 * lib/account/nuage (28 novembre 2026) : il ne sert pas à l'ouverture de l'app.
 */
export function etatNuage(): { allume: boolean; attente: boolean; changements: number; aJour: string | null; derniere: { quand: string; ok: boolean } | null; refus: CodeRefus | null; tropAncien: boolean; recharger: boolean } {
  const { e, derniere, ...reste } = etatBrut();
  const sales = TIROIRS.filter((n) => e[n]?.sale);
  const changements = sales.reduce((t, n) => t + Math.max(1, e[n]?.n ?? 1), 0);
  // À jour : le dernier envoi ou la dernière lecture réussis, ici ou gardés d'une visite d'avant.
  const dates = [derniere?.ok ? derniere.quand : null, ...TIROIRS.map((n) => e[n]?.aligne ?? null)].filter((d): d is string => !!d);
  // Un morceau manque (`recharger`) : jamais « à jour », Mon compte dit de recharger l'app.
  const aJour = !reste.recharger && dates.length ? dates.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b)) : null;
  // tropAncien : la copie est éteinte sur ce navigateur, l'écran peut dire TEXTE_TROP_ANCIEN.
  return { ...reste, attente: sales.length > 0, changements, aJour, derniere };
}

/** Un morceau de l'app n'a pas pu se charger (lib/account/nuage : morceauManquant) : seul le rechargement répare. */
export const TEXTE_RECHARGER = "La copie en ligne a besoin de recharger l’app.";

/** Ce que Mon compte dit de la copie en ligne (lib/account/nuage : etatNuage). */
export function texteCopie(e: { allume: boolean; attente: boolean; changements: number; aJour: string | null; refus?: RefusCopie; tropAncien?: boolean; recharger?: boolean }, maintenant = Date.now(), ici = "ce téléphone"): string {
  // Navigateur trop ancien pour la copie en clair (lib/account/nuage) : elle y est éteinte, on dit pourquoi.
  if (e.tropAncien) return TEXTE_TROP_ANCIEN;
  if (!e.allume) return `Pas de copie en ligne sur ${ici}`;
  // Plus rien ne part ni ne se lit tant que l'app n'est pas rechargée : jamais « à jour ».
  if (e.recharger) return TEXTE_RECHARGER;
  // Un refus passe avant « attend le réseau » : ce n'est pas le réseau, et attendre n'y changera rien.
  const refus = texteRefus(e.refus ?? null);
  if (refus) return refus;
  if (e.attente) {
    const n = Math.max(1, e.changements);
    return n > 1 ? `${n} changements attendent le réseau` : "1 changement attend le réseau";
  }
  if (!e.aJour) return "Copie en ligne : on vérifie…";
  const quand = heureDepuis(Date.parse(e.aJour), maintenant);
  return `Copie en ligne à jour ${quand.startsWith("le ") ? quand : `à ${quand}`}`;
}
