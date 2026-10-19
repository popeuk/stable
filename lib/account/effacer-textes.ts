import { cetAppareil, type Appareil } from "@/lib/appareil";

/**
 * Les phrases et les choix d'« Effacer mon écurie partout » et d'« Effacer
 * l'essai » (components/bs/effacer.tsx), à part pour être testés.
 */

/** Sous le bouton : ce qui sera effacé, dit selon l'appareil où l'on est. */
export function ouEfface(a?: Appareil): string {
  return `Ici, sur tes autres téléphones et ordinateurs, et dans ta copie en ligne. On te le redemande avant.`;
}

/** La copie de secours n'a pas pu être gardée (place pleine) : on ne promet rien. */
export function texteSansCopie(a?: Appareil): string {
  return `La copie de secours n’a pas pu être gardée sur ${cetAppareil(a)}. Fais une sauvegarde avant d’effacer.`;
}

/**
 * Peut-on effacer, et que dire après ? Avec la copie de secours : effacer,
 * récupérable 7 jours. Sans elle : seulement après une sauvegarde, ou si le
 * gérant a confirmé qu'il efface quand même ; et le message ne promet rien.
 */
export function issueEffacement(e: { misDeCote: boolean; sauve: boolean; confirme: boolean }): "recuperable" | "sans-copie" | "attendre" {
  if (e.misDeCote) return "recuperable";
  return e.sauve || e.confirme ? "sans-copie" : "attendre";
}

export function messageEfface(issue: "recuperable" | "sans-copie", jours: number, sauve: boolean, a?: Appareil): string {
  if (issue === "recuperable") return `Ton écurie est effacée. Tu peux la récupérer sur ${cetAppareil(a)} pendant ${jours} jours, dans Réglages, Avancé.`;
  return sauve ? "Ton écurie est effacée. Ta sauvegarde est dans tes téléchargements." : "Ton écurie est effacée.";
}

/** Les factures (et avoirs) de l'essai, citées avant de l'effacer ; rien s'il n'y en a pas. */
export function facturesDeLEssai(invoices: { number: string; kind?: "avoir" }[] | undefined): string | null {
  const liste = [...(invoices ?? [])].filter((i) => i.number).sort((a, b) => a.number.localeCompare(b.number));
  if (!liste.length) return null;
  const n = liste.length;
  const nums = liste.map((i) => `n° ${i.number}`);
  const cites = n <= 4 ? (n === 1 ? nums[0] : `${nums.slice(0, -1).join(", ")} et ${nums[n - 1]}`) : `du ${nums[0]} au ${nums[n - 1]}`;
  const avoirs = liste.filter((i) => i.kind === "avoir").length;
  const fact = n - avoirs;
  const dit = (k: number, un: string, plusieurs: string) => (k === 1 ? un : `${k} ${plusieurs}`);
  const quoi = [fact ? dit(fact, "une facture", "factures") : "", avoirs ? dit(avoirs, "un avoir", "avoirs") : ""].filter(Boolean).join(" et ");
  return `Ton essai a ${quoi} (${cites}). Une facture faite se garde 10 ans : fais d’abord une sauvegarde.`;
}
