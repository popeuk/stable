/**
 * Échappe un texte saisi avant de le mettre dans un message HTML (les
 * messages en bas d'écran sont rendus en HTML). Tout ce que le gérant ou un
 * client a tapé (nom de dépense, nom de cheval, de client) passe par ici.
 */
export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** Le message de « Faire payer » sur le ticket : le libellé et le nom sont échappés. */
export function msgFairePayer(label: string, owner: string | undefined, montant: string): string {
  return `« ${esc(label)} » ajouté à ce que doit payer ${esc(owner || "son propriétaire")} : <strong>+${montant}</strong>.`;
}
