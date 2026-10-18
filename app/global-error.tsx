"use client";

import { EcranErreur } from "@/components/bs/ecran-erreur";
import "./globals.css";
import "./bs.css";
import "./carnet.css";

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
            <EcranErreur error={error} onReessayer={() => unstable_retry()} />
          </main>
        </div>
      </body>
    </html>
  );
}
