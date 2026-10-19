"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Ic } from "@/components/carnet/ui";
import { useFeuille } from "@/components/bs/feuille";

/** Une feuille de confirmation de l'app, rendue dans document.body (iPhone). */
export function FeuilleConfirmer({ titre, onClose, children }: { titre: string; onClose: () => void; children: ReactNode }) {
  const ref = useFeuille(onClose, { verrou: true });
  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet" role="alertdialog" aria-modal="true" aria-label={titre} ref={ref}>
          <div className="grab" />
          <div className="shd">
            <b>{titre}</b>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          <div className="pad" style={{ display: "grid", gap: 10, paddingBottom: 8 }}>{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
