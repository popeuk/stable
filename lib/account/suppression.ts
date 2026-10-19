import { ApiError, type MessageContact } from "@/lib/account/api";
import { clearSession, scopeOf, type AccountSession } from "@/lib/account/session";

/**
 * « Supprimer mon compte » (Réglages, Mon compte). Il n'y a pas encore de
 * route qui supprime d'un coup : la demande part par Contact (pc-bestable
 * 1.5.0, POST /contact), avec un sujet clair et de quoi retrouver le compte.
 * L'équipe supprime le compte et la copie en ligne sous 30 jours, et l'écrit
 * par e-mail. Une fois la demande partie, l'écurie est effacée de cet
 * appareil et le compte déconnecté. Sans la route : on écrit à
 * contact@bestable.fr, et rien n'est effacé tant que la demande n'est pas partie.
 */

export const SUJET_SUPPRESSION = "Suppression du compte";
export const ADRESSE_SUPPRESSION = "contact@bestable.fr";
export const MESSAGE_SUPPRESSION_FAITE = "C’est demandé. Ton compte et ta copie en ligne seront supprimés sous 30 jours ; tu recevras un e-mail.";

/** Le message de la demande : le sujet en tête, puis qui demande. Aucun chiffre de l'écurie. */
export function messageSuppression(s: Pick<AccountSession, "userId" | "email" | "prenom" | "nom" | "telephone">, ecurie?: string): string {
  const qui = `${s.prenom ?? ""} ${s.nom ?? ""}`.trim();
  return [
    SUJET_SUPPRESSION,
    "",
    "Je demande la suppression de mon compte Be Stable et de ma copie en ligne.",
    "",
    `Compte n° ${s.userId}`,
    `E-mail : ${s.email}`,
    ...(qui ? [`Nom : ${qui}`] : []),
    ...(s.telephone ? [`Téléphone : ${s.telephone}`] : []),
    ...(ecurie ? [`Écurie : ${ecurie}`] : []),
  ].join("\n");
}

/** Ce qui part à la route Contact (le sujet aussi dans son champ, pour le site qui sait le lire). */
export function demandeSuppression(
  s: Pick<AccountSession, "userId" | "email" | "prenom" | "nom" | "telephone">,
  autour: Pick<MessageContact, "ecran" | "version" | "navigateur" | "appareil"> & { ecurie?: string },
): MessageContact & { sujet: string } {
  return { sujet: SUJET_SUPPRESSION, message: messageSuppression(s, autour.ecurie), ...autour };
}

/** Le lien e-mail de repli, déjà rempli. */
export function mailtoSuppression(s: Pick<AccountSession, "userId" | "email" | "prenom" | "nom" | "telephone">, ecurie?: string): string {
  return `mailto:${ADRESSE_SUPPRESSION}?subject=${encodeURIComponent(SUJET_SUPPRESSION)}&body=${encodeURIComponent(messageSuppression(s, ecurie))}`;
}

/** Tout ce que ce compte a rangé sur cet appareil (les clés « …@u42 »). */
export function effacerCompteIci(scope: string, stockage: Pick<Storage, "length" | "key" | "removeItem"> = localStorage): number {
  const fin = `@${scope}`;
  const cles: string[] = [];
  for (let i = 0; i < stockage.length; i++) {
    const k = stockage.key(i);
    if (k && k.endsWith(fin)) cles.push(k);
  }
  for (const k of cles) stockage.removeItem(k);
  return cles.length;
}

export type IssueSuppression = "demandee" | "repli" | "erreur";

/**
 * La demande, puis l'appareil : « demandee » (partie, l'écurie est effacée
 * ici et le compte déconnecté), « repli » (le site n'a pas la route : écrire
 * à contact@bestable.fr, rien n'est effacé), « erreur » (pas partie : rien
 * n'est effacé, on peut réessayer).
 */
export async function demanderLaSuppression(
  s: AccountSession,
  envoyer: () => Promise<unknown>,
  o: { deconnexion?: () => Promise<unknown>; stockage?: Pick<Storage, "length" | "key" | "removeItem"> } = {},
): Promise<{ issue: IssueSuppression; message?: string }> {
  try {
    await envoyer();
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return { issue: "repli" };
    return { issue: "erreur", message: e instanceof ApiError && e.message ? e.message : "La demande n’est pas partie. Réessaie dans un instant." };
  }
  try {
    await o.deconnexion?.();
  } catch {}
  const scope = scopeOf(s);
  clearSession();
  if (scope) effacerCompteIci(scope, o.stockage);
  return { issue: "demandee" };
}
