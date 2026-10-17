/**
 * La fusion de deux copies d'un tiroir à partir de leur dernière version
 * commune (la « base ») : ce qu'un seul côté a changé passe, ce que les deux
 * ont changé au même endroit revient au plus récent. Les listes d'éléments
 * qui portent un `id` (chevaux, recettes, séances…) se fusionnent élément
 * par élément : un ajout d'un côté et une modification de l'autre restent
 * tous les deux.
 */
type J = unknown;

const egal = (a: J, b: J) => JSON.stringify(a) === JSON.stringify(b);
const objet = (v: J): v is Record<string, J> => !!v && typeof v === "object" && !Array.isArray(v);
const avecIds = (v: J): v is { id: string }[] => Array.isArray(v) && v.every((x) => objet(x) && (typeof x.id === "string" || typeof x.id === "number"));

function liste(b: J, l: { id: string }[], r: { id: string }[], localGagne: boolean): J[] {
  const parId = (xs: J) => new Map((avecIds(xs) ? xs : []).map((x) => [String(x.id), x as J]));
  const B = parId(b);
  const L = parId(l);
  const R = parId(r);
  // L'ordre du serveur, puis ce que l'appareil a ajouté.
  const ordre = [...R.keys(), ...[...L.keys()].filter((k) => !R.has(k))];
  const out: J[] = [];
  for (const k of ordre) {
    const v = valeur(B.get(k), L.get(k), R.get(k), localGagne);
    if (v !== undefined) out.push(v);
  }
  return out;
}

function valeur(b: J, l: J, r: J, localGagne: boolean): J {
  if (egal(l, r)) return l;
  if (egal(l, b)) return r;
  if (egal(r, b)) return l;
  // Les deux ont changé.
  if (l === undefined || r === undefined) {
    // Retiré d'un côté, modifié de l'autre : la modification reste.
    return l === undefined ? r : l;
  }
  if (avecIds(l) && avecIds(r) && (b === undefined || avecIds(b))) return liste(b, l, r, localGagne);
  if (objet(l) && objet(r)) {
    const bo = objet(b) ? b : {};
    const out: Record<string, J> = {};
    for (const k of new Set([...Object.keys(r), ...Object.keys(l)])) {
      const v = valeur(bo[k], l[k], r[k], localGagne);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return localGagne ? l : r;
}

/** Fusionne trois versions d'un tiroir (texte JSON). Rend null si l'une ne se lit pas. */
export function fusionner3(base: string, locale: string, distant: string, localGagne: boolean): string | null {
  try {
    const b = JSON.parse(base) as J;
    const l = JSON.parse(locale) as J;
    const r = JSON.parse(distant) as J;
    // Deux versions du format de données différentes : pas de fusion fine.
    if (objet(l) && objet(r) && l.version !== r.version) return null;
    return JSON.stringify(valeur(b, l, r, localGagne));
  } catch {
    return null;
  }
}
