/**
 * « Gros texte » (Réglages, Mon téléphone) : tout l'écran grandit d'environ
 * 15 %. Le choix vaut pour cet appareil, pas pour le compte : il est rangé à
 * part dans le stockage du navigateur, en clair, comme « be-stable-visits ».
 * Le script du <head> (TAILLE_TOT) le pose sur <html data-taille="grand">
 * avant le premier affichage, sans saut ; le zoom vit dans carnet.css.
 */
export const CLE_TAILLE = "be-stable-taille";

/** Lu dans le <head>, avant tout le reste : rien ne bouge à l'ouverture. */
export const TAILLE_TOT = `try{if(localStorage.getItem("${CLE_TAILLE}")==="grand")document.documentElement.setAttribute("data-taille","grand")}catch(e){}`;

/** Le gros texte est-il en marche sur cet appareil ? (ce que montre <html>). */
export function grosTexte(): boolean {
  return typeof document !== "undefined" && document.documentElement.getAttribute("data-taille") === "grand";
}

/** Met ou retire le gros texte, tout de suite et pour les prochaines ouvertures. */
export function poserGrosTexte(on: boolean) {
  if (on) document.documentElement.setAttribute("data-taille", "grand");
  else document.documentElement.removeAttribute("data-taille");
  // Navigation privée ou stockage plein : le choix tient jusqu'à la fermeture.
  try {
    if (on) localStorage.setItem(CLE_TAILLE, "grand");
    else localStorage.removeItem(CLE_TAILLE);
  } catch {}
}
