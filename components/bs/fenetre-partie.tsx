"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Ic } from "@/components/carnet/ui";
import { useFeuille } from "@/components/bs/feuille";
import "@/app/carnet/presence.css";

/**
 * Une partie de la Vitrine ouverte en fenêtre (29 octobre 2026, maquette
 * validée) : la partie touchée s'ouvre par-dessus la fiche, avec son bouton
 * d'enregistrement. Posée sur document.body, sinon elle s'écrase sur iPhone.
 */
export function FenetrePartie({ titre, n, onClose, children }: { titre: string; n: number; onClose: () => void; children: ReactNode }) {
  const ref = useFeuille(onClose, { verrou: true });
  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet nt-sheet bq-fq pr-vt-sheet" role="dialog" aria-modal="true" aria-label={titre} ref={ref}>
          <div className="grab" />
          <div className="shd">
            <span className="bq-fq-n">Partie {n} sur 4</span>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          <div className="pad">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
