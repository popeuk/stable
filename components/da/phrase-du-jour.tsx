"use client";

/**
 * La phrase du jour sur l'Accueil (reprise de l'app du Clos,
 * ~/Dreadsprint-v2/components/PhraseDuJour.tsx, 26 novembre 2026) : une seule
 * phrase, courte, en grand, qui change chaque jour. Tutoiement, clins d'œil
 * justes du monde du cheval, jamais de promesse. Styles : app/da.css (.da-mot).
 */
const PHRASES = [
  "Un cheval heureux, c’est la plus belle vitrine.",
  "Les cavaliers restent pour l’ambiance que tu crées.",
  "Chaque écurie avance à son rythme.",
  "Une sellerie rangée, un esprit tranquille.",
  "Ton meilleur argument : un cavalier qui sourit.",
  "Les bons mois se préparent un peu chaque jour.",
  "Un cheval ne triche pas. Tes chiffres non plus.",
  "Au pas, au trot, au galop : tu avances.",
  "Ce qui marche mérite d’être su.",
  "Une belle écurie, ça se voit. Et ça se compte.",
];

export function PhraseDuJour() {
  const d = new Date();
  const jour = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
  return <p className="da-mot">{PHRASES[jour % PHRASES.length]}</p>;
}
