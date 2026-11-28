/**
 * Format « en clair » de la copie en ligne : l'app n'enchiffre plus ce qu'elle
 * envoie, elle compresse (gzip) puis encode en base64, avec le préfixe
 * « bs-clair2: ». Les anciennes copies chiffrées (« bs-enc1: » / « bs-enc2: »)
 * restent lisibles, par le coffre passé en paramètre.
 */

export const PREFIXE_CLAIR = "bs-clair2:";
const PREFIXES_CHIFFRES = ["bs-enc1:", "bs-enc2:"];

export const estClair = (c: string) => c.startsWith(PREFIXE_CLAIR);

async function passer(bytes: Uint8Array, flux: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const sortie = new Blob([bytes as BlobPart]).stream().pipeThrough(flux);
  return new Uint8Array(await new Response(sortie).arrayBuffer());
}

/** Base64 par morceaux, pour que les gros contenus ne fassent pas exploser la pile. */
function versBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function depuisBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Le texte clair devient « bs-clair2:<gzip en base64> ». */
export async function versClair(clair: string): Promise<string> {
  const compresse = await passer(new TextEncoder().encode(clair), new CompressionStream("gzip"));
  return PREFIXE_CLAIR + versBase64(compresse);
}

/**
 * Lit ce que le serveur a gardé. Clair : on décompresse. Chiffré : on passe par
 * `ouvrirScelle`. Autre chose, ou contenu abîmé : `null`, sans jamais lever.
 */
export async function depuisDistant(contenu: string, ouvrirScelle: (s: string) => Promise<string | null>): Promise<string | null> {
  try {
    if (estClair(contenu)) {
      const octets = await passer(depuisBase64(contenu.slice(PREFIXE_CLAIR.length)), new DecompressionStream("gzip"));
      return new TextDecoder("utf-8", { fatal: true }).decode(octets);
    }
    if (PREFIXES_CHIFFRES.some((p) => contenu.startsWith(p))) return await ouvrirScelle(contenu);
    return null;
  } catch {
    return null;
  }
}
