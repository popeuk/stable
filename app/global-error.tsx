"use client";

import { lazy, Suspense } from "react";
import "./globals.css";
import "./bs.css";
import "./carnet.css";

/**
 * Repli si même l'écran d'erreur ne se charge pas (hors ligne, version
 * retirée) : de quoi réessayer ou recharger, sans rien qui efface.
 */
function Repli({ onReessayer }: { error: unknown; onReessayer?: () => void }) {
  return (
    <div className="pad" style={{ display: "grid", gap: 10, paddingTop: 40 }}>
      <h1>Cet écran a eu un souci</h1>
      <p>Tes chiffres ne sont pas touchés.</p>
      <button type="button" className="btn full" onClick={onReessayer}>
        Réessayer
      </button>
      <button type="button" className="btn line full" onClick={() => window.location.reload()}>
        Recharger l’app
      </button>
    </div>
  );
}

/**
 * L'écran d'erreur ne se charge qu'en cas d'erreur : le dernier filet, présent
 * sous chaque page, ne pèse rien.
 */
const EcranErreur = lazy(() =>
  import("@/components/bs/ecran-erreur").then(
    (m) => ({ default: m.EcranErreur }),
    () => ({ default: Repli }),
  ),
);

/**
 * Le dernier filet : une erreur dans la mise en page racine. Remplace toute la
 * page, d'où ses propres <html> et <body>. Même écran que error.tsx.
 */
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="fr">
      <body>
        <title>Be Stable</title>
        <div className="carnet">
          <main className="cn-main">
            <Suspense fallback={null}>
              <EcranErreur error={error} onReessayer={() => unstable_retry()} />
            </Suspense>
          </main>
        </div>
      </body>
    </html>
  );
}
