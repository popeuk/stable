/**
 * Une petite vibration (30 ms par défaut), quand un client paie : le geste
 * se sent dans la main. Sans effet là où le téléphone ne vibre pas (iPhone,
 * ordinateur) ou si le navigateur refuse : jamais d'erreur.
 */
export function vibrer(ms = 30): void {
  try {
    if (typeof navigator !== "undefined") navigator.vibrate?.(ms);
  } catch {}
}
