"use client";

import { createPortal } from "react-dom";
import { Ic, Ill } from "@/components/carnet/ui";
import { useInstall } from "@/lib/pwa";
import { INSTALL_HOWTO } from "@/lib/pwa-gestes";
import { useFeuille } from "@/components/bs/feuille";
import { useOuChiffres } from "@/components/bs/ou-chiffres";

/** Les gestes pour installer l'app, sur tous les écrans (téléphone compris). */
export function InstallHowto({ onClose }: { onClose: () => void }) {
  const install = useInstall();
  const steps = INSTALL_HOWTO[install.way === "bouton" ? "autre" : install.way];
  const ref = useFeuille(onClose, { verrou: true });
  const ou = useOuChiffres();
  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet nt-sheet" role="dialog" aria-modal="true" aria-labelledby="bs-install-t" ref={ref}>
          <div className="grab" />
          <div className="shd">
            <b id="bs-install-t">Installer l’app</b>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          <div className="pad">
            <p className="note" style={{ marginTop: 0 }}>
              Une icône sur ton bureau ou ton écran d’accueil, une fenêtre à part, et l’app s’ouvre même sans réseau.
            </p>
            <ol className="nt-steps">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <div className="tip" style={{ marginTop: 16 }}>
              <Ill n="guide" />
              <span>{ou.compte ? "Avec ton compte, l’app installée sur l’ordinateur et celle du téléphone retrouvent la même écurie." : `Sans compte, tes chiffres restent sur ${ou.cet} : l’app installée ailleurs ne les voit pas.`}</span>
            </div>
            <button type="button" className="btn full" style={{ marginTop: 16 }} onClick={onClose}>
              J’ai compris
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

