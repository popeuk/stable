"use client";

import { lazy, Suspense } from "react";
// Pris à sa source : « next/error » tire aussi la page d'erreur du routeur Pages (inutile ici).
import { unstable_catchError } from "next/dist/client/components/catch-error";
import type { ErrorInfo } from "next/error";

type Props = { error: unknown; onReessayer?: () => void };

/**
 * Repli si même l'écran d'erreur ne se charge pas (hors ligne, version
 * retirée) : de quoi réessayer ou recharger, sans rien qui efface.
 */
function Repli({ onReessayer }: Props) {
  return (
    <div className="pad" style={{ display: "grid", gap: 10, paddingTop: 40 }}>
      <h1>Cet écran a eu un souci</h1>
      <p>Tes chiffres ne sont pas touchés.</p>
      {onReessayer && (
        <button type="button" className="btn full" onClick={onReessayer}>
          Réessayer
        </button>
      )}
      <button type="button" className="btn line full" onClick={() => window.location.reload()}>
        Recharger l’app
      </button>
    </div>
  );
}

/** L'écran d'erreur (components/bs/ecran-erreur.tsx) ne se charge qu'en cas d'erreur : il ne pèse sur aucune page. */
const Ecran = lazy(() =>
  import("@/components/bs/ecran-erreur").then(
    (m) => ({ default: m.EcranErreur }),
    () => ({ default: Repli }),
  ),
);

export function EcranErreurDiffere(props: Props) {
  return (
    <Suspense fallback={null}>
      <Ecran {...props} />
    </Suspense>
  );
}

function SecoursCoque(_props: object, { error, unstable_retry }: ErrorInfo) {
  return (
    <div className="carnet">
      <main className="cn-main">
        <EcranErreurDiffere error={error} onReessayer={() => unstable_retry()} />
      </main>
    </div>
  );
}

/**
 * La limite d'erreur autour de la coque (en-tête, barre d'onglets, feuilles,
 * synchronisation) : si l'une d'elles plante, l'écran d'erreur remplace la
 * page blanche.
 */
export const LimiteCoque = unstable_catchError(SecoursCoque);
