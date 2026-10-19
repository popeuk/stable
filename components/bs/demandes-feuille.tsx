"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Ic } from "@/components/carnet/ui";
import { useFeuille } from "@/components/bs/feuille";
import { quandDemande, useDemandes } from "@/lib/account/demandes";
import type { DemandeCavalier } from "@/lib/account/api";

/** La liste « Demandes » : ouverte, toutes les demandes affichées sont vues. */
export function DemandesFeuille({ onClose }: { onClose: () => void }) {
  const ref = useFeuille(onClose, { verrou: true });
  const fiche = useDemandes((s) => s.fiche);
  const demandes = useDemandes((s) => s.demandes);
  const toutVoir = useDemandes((s) => s.toutVoir);
  // Les nouvelles le restent à l'écran le temps de la lecture, même une fois signalées vues au site.
  const [nouvelles] = useState(() => new Set(demandes.filter((d) => !d.vue).map((d) => d.id)));
  useEffect(() => {
    void toutVoir();
  }, [toutVoir]);
  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet nt-sheet" role="dialog" aria-modal="true" aria-labelledby="dm-t" ref={ref}>
          <div className="grab" />
          <div className="shd">
            <b id="dm-t">Demandes</b>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          <div className="pad">
            {!fiche ? (
              <>
                <p className="note" style={{ marginTop: 0 }}>
                  Les cavaliers t’écrivent depuis ta fiche sur bestable.fr. Dès qu’elle est à ton nom, leurs demandes arrivent ici.
                </p>
                <Link href="/ma-fiche" className="btn full" onClick={onClose}>
                  Reprendre ma fiche
                </Link>
              </>
            ) : demandes.length === 0 ? (
              <p className="note" style={{ marginTop: 0 }}>
                Pas encore de demande pour {fiche.title}. Quand un cavalier t’écrit depuis ta fiche, tu la retrouves ici, et aussi par e-mail.
              </p>
            ) : (
              demandes.map((d) => <Demande key={d.id} d={d} nouvelle={nouvelles.has(d.id)} ecurie={fiche.title} />)
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Demande({ d, nouvelle, ecurie }: { d: DemandeCavalier; nouvelle: boolean; ecurie: string }) {
  const sujet = encodeURIComponent(`Ta demande à ${ecurie}`);
  return (
    <article className="dm-li">
      <div className="dm-hd">
        <b>
          {d.nom || "Un cavalier"}
          {nouvelle && <span className="dm-new">nouvelle</span>}
        </b>
        <small>{quandDemande(d.date)}</small>
      </div>
      {d.cherche && <p className="dm-ch">{d.cherche}</p>}
      {d.message && <p className="dm-msg">{d.message}</p>}
      {(d.telephone || d.email) && (
        <div className="dm-act">
          {d.telephone && (
            <a className="btn" href={`tel:${d.telephone}`}>
              Appeler
            </a>
          )}
          {d.email && (
            <a className="btn line" href={`mailto:${d.email}?subject=${sujet}`}>
              Écrire
            </a>
          )}
        </div>
      )}
    </article>
  );
}
