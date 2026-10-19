"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cetAppareil } from "@/lib/appareil";
import { demanderPersistance, ecouterPlace, etatPlace, messagePlace } from "@/lib/account/place";
import { exporterCeQuiReste } from "@/components/bs/secours";
import { localToday } from "@/lib/utils/local-date";

/**
 * Le bandeau de la place sur l'appareil (lib/account/place). Plus de place :
 * il le dit tout de suite et reste, avec l'heure du dernier enregistrement,
 * et propose une sauvegarde de ce qui est à l'écran (même ce qui n'a pas pu
 * être enregistré). Bientôt plein (70 %) : il prévient doucement, et se
 * ferme jusqu'au lendemain. À poser une fois dans app/(app)/layout.tsx.
 */
const FERME = "bs-place-ferme";

export function PlaceBandeau() {
  const e = useSyncExternalStore(ecouterPlace, etatPlace, etatPlace);
  const [ou, setOu] = useState<string | null>(null);
  const [ferme, setFerme] = useState(false);
  useEffect(() => {
    demanderPersistance();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOu(cetAppareil());
    try {
      if (localStorage.getItem(FERME) === localToday()) setFerme(true);
    } catch {}
  }, []);
  if (!ou) return null;
  const msg = messagePlace(e, ou);
  if (!msg || (!msg.fort && ferme)) return null;
  return (
    <div className={`es-keep bs-place${msg.fort ? " fort" : ""}`} role={msg.fort ? "alert" : "status"}>
      <span>{msg.fort ? <b>{msg.texte}</b> : msg.texte}</span>
      {msg.fort ? (
        <button type="button" className="btn" onClick={() => exporterCeQuiReste(undefined, "be-stable")}>
          Faire une sauvegarde
        </button>
      ) : (
        <button
          type="button"
          className="es-x"
          aria-label="Fermer jusqu’à demain"
          onClick={() => {
            try {
              localStorage.setItem(FERME, localToday());
            } catch {}
            setFerme(true);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}
