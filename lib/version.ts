/**
 * Le numéro de version, en bas de Réglages : « Version 3bdc74f · 18 octobre ».
 * Posé au build par le workflow (.github/workflows/pages.yml, job vps) depuis
 * GITHUB_SHA et la date du commit ; en local, « Version locale ».
 */
export function versionDite(sha: string | undefined = process.env.NEXT_PUBLIC_VERSION, quand: string | undefined = process.env.NEXT_PUBLIC_VERSION_DATE): string {
  const court = (sha ?? "").trim().slice(0, 7);
  if (!court) return "Version locale";
  const t = quand ? Date.parse(quand) : NaN;
  const jour = Number.isFinite(t) ? new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" }) : "";
  return jour ? `Version ${court} · ${jour}` : `Version ${court}`;
}
