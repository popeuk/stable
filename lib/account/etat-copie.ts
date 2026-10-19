import { heureDepuis } from "@/lib/account/place";

/** Le serveur refuse la copie : trop grosse (413) ou mal formée (400). */
export type RefusCopie = "trop_gros" | "invalide" | null;

/** La phrase du refus, pour Mon compte et le bandeau (la même partout). */
export function texteRefus(refus: RefusCopie): string | null {
  if (refus === "trop_gros") return "Ta copie en ligne ne part plus : ton écurie est trop grosse. Fais une sauvegarde.";
  if (refus === "invalide") return "Ta copie en ligne ne part plus. Fais une sauvegarde et écris-nous.";
  return null;
}

/** Ce que Mon compte dit de la copie en ligne (lib/account/nuage : etatNuage). */
export function texteCopie(e: { allume: boolean; attente: boolean; changements: number; aJour: string | null; refus?: RefusCopie }, maintenant = Date.now(), ici = "ce téléphone"): string {
  if (!e.allume) return `Pas de copie en ligne sur ${ici}`;
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
