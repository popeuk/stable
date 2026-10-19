import type { InstallWay } from "@/lib/pwa";

/** Les mots pour installer, selon l'appareil. */
export const INSTALL_HOWTO: Record<Exclude<InstallWay, "bouton">, string[]> = {
  ios: ["Ouvre l’app dans Safari.", "Touche le bouton Partager (le carré avec une flèche).", "Choisis « Sur l’écran d’accueil », puis « Ajouter »."],
  "safari-mac": ["Dans Safari, menu Fichier.", "Choisis « Ajouter au Dock ».", "Be Stable s’ouvre ensuite comme une app, depuis le Dock ou le Launchpad."],
  autre: [
    "Ouvre l’app dans Chrome ou Edge, sur ordinateur ou sur Android.",
    "Clique sur l’icône d’installation à droite de la barre d’adresse (un écran avec une flèche), ou menu ⋮ puis « Installer Be Stable ».",
    "Sur Android, menu ⋮ puis « Ajouter à l’écran d’accueil ».",
  ],
};
