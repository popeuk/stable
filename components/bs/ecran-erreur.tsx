"use client";

import { useEffect, useState } from "react";
import { unstable_catchError, type ErrorInfo } from "next/error";
import { Hello, Ic, Page } from "@/components/carnet/ui";
import { withBase } from "@/components/bs/ui";
import { rangementSession, rechargerUneFois } from "@/lib/erreur";
import { signalerErreur } from "@/lib/suivi-erreurs";

/**
 * L'écran d'erreur honnête : un écran a planté, les chiffres ne sont pas
 * touchés. Trois gestes, aucun qui efface. L'écran de secours (données
 * abîmées à la lecture, `secours` du store) reste à part, dans secours.tsx.
 */
export function EcranErreur({ error, onReessayer }: { error: unknown; onReessayer?: () => void }) {
  const [recharge, setRecharge] = useState(false);
  useEffect(() => {
    console.error(error);
    // Un morceau de code introuvable après une mise en ligne : on recharge une fois.
    if (rechargerUneFois(error, rangementSession())) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecharge(true);
      window.location.reload();
      return;
    }
    // Samuel le sait (le message, l'écran, la version, le navigateur ; rien de l'écurie).
    void signalerErreur("ecran", error);
  }, [error]);
  if (recharge) {
    return (
      <Page>
        <Hello title="Une nouvelle version arrive" sub="L’app se recharge." />
      </Page>
    );
  }
  return (
    <Page>
      <Hello title="Cet écran a eu un souci" sub="Tes chiffres ne sont pas touchés. Réessaie, ou reviens à l’accueil." />
      <div className="pad rise" style={{ display: "grid", gap: 10, marginTop: 16, animationDelay: ".1s" }}>
        {onReessayer && (
          <button type="button" className="btn full" onClick={onReessayer}>
            Réessayer
          </button>
        )}
        <a className={onReessayer ? "btn line full" : "btn full"} href={withBase("/accueil/")}>
          <Ic n="home" className="" />
          Revenir à l’accueil
        </a>
        <button type="button" className="btn line full" onClick={() => window.location.reload()}>
          Recharger l’app
        </button>
      </div>
      <div className="end" />
    </Page>
  );
}

function SecoursCoque(_props: object, { error, unstable_retry }: ErrorInfo) {
  return (
    <div className="carnet">
      <main className="cn-main">
        <EcranErreur error={error} onReessayer={() => unstable_retry()} />
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
