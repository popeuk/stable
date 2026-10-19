/**
 * Le fichier de sauvegarde (« Faire une sauvegarde », et la copie de ce qui
 * reste de l'écran de secours). Depuis le 19 octobre 2026 (format 3), il dit
 * la version des données et des réglages qu'il contient : la reprise les
 * met à jour depuis la bonne version, et refuse un fichier fait par une
 * version plus récente de l'app (audit technique I4). Les fichiers d'avant
 * (format 2, sans version) sont repris comme des données en version 4.
 */
export const FORMAT_SAUVEGARDE = 3;
/** La version des données d'un fichier d'avant, qui ne la disait pas. */
export const VERSION_DONNEES_ANCIENNE = 4;

export function contenuSauvegarde(p: {
  data: Record<string, unknown>;
  settings: Record<string, unknown>;
  versionDonnees: number;
  versionReglages: number;
  quand?: Date;
  plus?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    app: "be-stable",
    version: FORMAT_SAUVEGARDE,
    exportedAt: (p.quand ?? new Date()).toISOString(),
    "be-stable-data": { state: p.data, version: p.versionDonnees },
    "be-stable-settings": { state: p.settings, version: p.versionReglages },
    ...(p.plus ?? {}),
  };
}

/** Télécharge le fichier (dans le navigateur). */
export function telechargerSauvegarde(contenu: Record<string, unknown>, nom: string) {
  const blob = new Blob([JSON.stringify(contenu)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
