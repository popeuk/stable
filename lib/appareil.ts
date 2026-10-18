/**
 * Le nom de l'appareil, pour dire au gérant où sont ses chiffres : « ce
 * téléphone » ou « cet ordinateur ». Un écran tactile ou étroit (moins de
 * 1024 px, la limite de la coque de bureau) est un téléphone ; le reste, un
 * ordinateur.
 */
export type Appareil = "téléphone" | "ordinateur";

export function appareilDe(ua: string, largeur: number): Appareil {
  if (/iPhone|iPod|Android.*Mobile|Mobile Safari|Windows Phone/i.test(ua)) return "téléphone";
  return largeur > 0 && largeur < 1024 ? "téléphone" : "ordinateur";
}

export function appareil(): Appareil {
  if (typeof window === "undefined") return "téléphone";
  return appareilDe(navigator.userAgent ?? "", window.innerWidth || 0);
}

/** « ce téléphone » ou « cet ordinateur ». */
export function cetAppareil(a: Appareil = appareil()): string {
  return a === "téléphone" ? "ce téléphone" : "cet ordinateur";
}

/** « Ce téléphone » ou « Cet ordinateur », en début de phrase. */
export function CetAppareil(a: Appareil = appareil()): string {
  const s = cetAppareil(a);
  return s[0].toUpperCase() + s.slice(1);
}

/** Où sont les chiffres, selon la session : sans compte, sur l'appareil ; avec un compte, aussi dans la copie en ligne. */
export function ouSontLesChiffres(compte: boolean, a: Appareil = appareil()): string {
  return compte ? `sur ${cetAppareil(a)} et dans ta copie en ligne, protégée` : `sur ${cetAppareil(a)}`;
}
