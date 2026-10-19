/**
 * Des données écrites par une version plus récente de l'app (un autre
 * appareil à jour, ou un onglet resté sur l'ancienne version). Cette app ne
 * sait pas les lire en entier : elle n'écrit rien par-dessus (sinon elle les
 * redescendrait à sa version), se recharge une fois pour prendre la nouvelle
 * version, et sinon le dit (bandeau, components/bs/copie-bandeau.tsx).
 */
let plusRecentes = false;
const ecoutes = new Set<() => void>();
const CLE = "be-stable-recharge-version";

export function donneesPlusRecentes(): boolean {
  return plusRecentes;
}
export function ecouterVersion(f: () => void) {
  ecoutes.add(f);
  return () => {
    ecoutes.delete(f);
  };
}

/** Le stockage dit une version `v` ; l'app connaît `actuelle`. Rend true si elles sont plus récentes. */
export function noterVersionLue(v: number, actuelle: number, rangement: Pick<Storage, "getItem" | "setItem"> | null = session(), maintenant = Date.now()): boolean {
  if (!(v > actuelle)) return false;
  if (!plusRecentes) {
    plusRecentes = true;
    for (const f of ecoutes) f();
  }
  // Une fois par minute au plus : jamais de boucle si le site sert encore l'ancienne version.
  try {
    const avant = Number(rangement?.getItem(CLE) ?? 0);
    if (rangement && !(avant && maintenant - avant < 60_000)) {
      rangement.setItem(CLE, String(maintenant));
      if (typeof window !== "undefined" && typeof window.location?.reload === "function") window.location.reload();
    }
  } catch {}
  return true;
}

function session(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof window !== "undefined" && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** Pour les tests. */
export function _oublierVersion() {
  plusRecentes = false;
}
