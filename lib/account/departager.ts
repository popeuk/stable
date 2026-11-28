import { fusionFactures } from "@/lib/domain/factures-base";
import { fusionner3 } from "@/lib/account/fusion";
import type { StableData } from "@/lib/domain/types";

// Sorti de lib/account/nuage.ts (28 novembre 2026) : il ne sert qu'aux conflits et se charge à la demande.

/**
 * Le choix entre la copie de l'appareil et celle du serveur. Pur : rend
 * le contenu à garder, et qui a gagné. Avec la dernière version commune,
 * les deux côtés se fusionnent (lib/account/fusion) : ce que chacun a
 * changé reste, le plus récent ne l'emporte que là où les deux ont changé
 * la même chose. Sans elle (appareil jamais aligné), la copie en ligne
 * gagne. Les factures des deux côtés restent toujours.
 */
export function departager(
  nom: string,
  locale: { clair: string; modifie?: string; vu?: boolean },
  distant: { clair: string; modifie: string },
  base: string | null = null,
): { gagnant: "locale" | "distant"; clair: string; fusion: boolean } {
  const distantGagne = !locale.vu || !locale.modifie || Date.parse(distant.modifie) >= Date.parse(locale.modifie);
  const fusion = locale.vu && base !== null ? fusionner3(base, locale.clair, distant.clair, !distantGagne) : null;
  const [g, p] = fusion !== null ? [fusion, distant.clair] : distantGagne ? [distant.clair, locale.clair] : [locale.clair, distant.clair];
  let clair = g;
  if (nom === "be-stable-data") {
    try {
      const pg = JSON.parse(g) as { state?: Partial<StableData> };
      const pp = JSON.parse(p) as { state?: Partial<StableData> };
      if (pg?.state && pp?.state) {
        const f = fusionFactures(pg.state as StableData, pp.state as StableData);
        const avant = (pg.state.invoices ?? []).length;
        const seqAvant = JSON.stringify(pg.state.invoiceSeq ?? {});
        if (f.invoices.length !== avant || JSON.stringify(f.invoiceSeq) !== seqAvant) clair = JSON.stringify({ ...pg, state: { ...pg.state, ...f } });
      }
    } catch {
      // Un des deux ne se lit pas : on garde le gagnant tel quel.
    }
  }
  if (fusion !== null) return { gagnant: clair === distant.clair ? "distant" : "locale", clair, fusion: true };
  return { gagnant: distantGagne ? "distant" : "locale", clair, fusion: false };
}
