"use client";

import { createPortal } from "react-dom";
import { prendreLaMain } from "@/lib/onglet";

/** Be Stable est ouvert ailleurs : cet onglet n'écrit plus rien, « Reprendre ici » le recharge (components/bs/un-seul-onglet.tsx). */
export function OngletEnPause() {
  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" />
        <div className="sheet" role="alertdialog" aria-modal="true" aria-labelledby="onglet-t">
          <div className="shd">
            <b id="onglet-t">Be Stable est ouvert dans un autre onglet</b>
          </div>
          <div className="pad" style={{ display: "grid", gap: 10, paddingBottom: 16 }}>
            <p className="note" style={{ marginTop: 0 }}>
              Pour ne rien écraser, un seul onglet note à la fois. Continue dans l’autre, ou reprends ici : l’app se recharge avec tout ce que tu as noté.
            </p>
            <button
              type="button"
              className="btn full"
              onClick={() => {
                prendreLaMain();
                window.location.reload();
              }}
            >
              Reprendre ici
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
