/**
 * La taille du texte (Réglages, Affichage) : normale, « Gros texte » (tout
 * l'écran grandit d'environ 15 %) ou « Très gros texte » (environ 50 %,
 * décision 5 du 18 octobre ; le zoom au doigt reste bloqué). Le choix vaut
 * pour cet appareil, pas pour le compte : il est rangé à part dans le stockage
 * du navigateur, en clair, comme « be-stable-visits ». Le script du <head>
 * (TAILLE_TOT) le pose sur <html data-taille="grand" | "tres-grand"> avant le
 * premier affichage, sans saut ; le zoom vit dans carnet.css.
 */
export const CLE_TAILLE = "be-stable-taille";

export type Taille = "normal" | "grand" | "tres-grand";
const TAILLES: Taille[] = ["normal", "grand", "tres-grand"];

/** Lu dans le <head>, avant tout le reste : rien ne bouge à l'ouverture. */
export const TAILLE_TOT = `try{var t=localStorage.getItem("${CLE_TAILLE}");if(t==="grand"||t==="tres-grand")document.documentElement.setAttribute("data-taille",t)}catch(e){}`;

/** La taille en marche sur cet appareil (ce que montre <html>). */
export function tailleTexte(): Taille {
  if (typeof document === "undefined") return "normal";
  const t = document.documentElement.getAttribute("data-taille") as Taille | null;
  return t && TAILLES.includes(t) ? t : "normal";
}

/** Le gros texte (l'un ou l'autre niveau) est-il en marche ? */
export function grosTexte(): boolean {
  return tailleTexte() !== "normal";
}

/** Pose une taille, tout de suite et pour les prochaines ouvertures. */
export function poserTaille(t: Taille) {
  if (t === "normal") document.documentElement.removeAttribute("data-taille");
  else document.documentElement.setAttribute("data-taille", t);
  // Navigation privée ou stockage plein : le choix tient jusqu'à la fermeture.
  try {
    if (t === "normal") localStorage.removeItem(CLE_TAILLE);
    else localStorage.setItem(CLE_TAILLE, t);
  } catch {}
}

/** Met ou retire le gros texte (premier niveau). */
export function poserGrosTexte(on: boolean) {
  poserTaille(on ? "grand" : "normal");
}
