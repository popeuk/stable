import { heureDepuis } from "@/lib/account/place";

/** Ce que Mon compte dit de la copie en ligne (lib/account/nuage : etatNuage). */
export function texteCopie(e: { allume: boolean; attente: boolean; changements: number; aJour: string | null }, maintenant = Date.now()): string {
  if (!e.allume) return "Copie en ligne éteinte ici";
  if (e.attente) {
    const n = Math.max(1, e.changements);
    return n > 1 ? `${n} changements attendent le réseau` : "1 changement attend le réseau";
  }
  if (!e.aJour) return "Copie en ligne : on vérifie…";
  const quand = heureDepuis(Date.parse(e.aJour), maintenant);
  return `Copie en ligne à jour ${quand.startsWith("le ") ? quand : `à ${quand}`}`;
}
