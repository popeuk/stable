"use client";

import { useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFeuille } from "@/components/bs/feuille";
import { Ic } from "@/components/carnet/ui";
import { MOYENS, saisieCheque } from "@/lib/domain/paiement";
import type { PaymentMethod } from "@/lib/domain/types";

/**
 * Comment il a payé, en un toucher : chèque, espèces, virement, autre. Pour
 * un chèque, un numéro facultatif. Styles : app/carnet/facture.css (mp-).
 */
export function MoyenChoix({
  value,
  onChange,
  cheque,
  onCheque,
  demande,
}: {
  value?: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
  cheque: string;
  onCheque: (v: string) => void;
  /** On a touché « payé » sans choisir : on le demande. */
  demande?: boolean;
}) {
  const q = useId();
  return (
    <div className="mp">
      <p className={`mp-q${demande ? " ask" : ""}`} id={q}>
        {demande ? "Choisis d’abord comment :" : "Comment ?"}
      </p>
      <div className="mp-chips" role="radiogroup" aria-labelledby={q}>
        {MOYENS.map(([m, label]) => (
          <button key={m} type="button" role="radio" aria-checked={value === m} className={`chip${value === m ? " on" : ""}`} onClick={() => onChange(m)}>
            {label}
          </button>
        ))}
      </div>
      {value === "cheque" && (
        <label className="mp-chq">
          <span>N° du chèque</span>
          <input className="input" inputMode="numeric" autoComplete="off" placeholder="facultatif" value={cheque} onChange={(e) => onCheque(saisieCheque(e.target.value))} />
        </label>
      )}
    </div>
  );
}


/**
 * Une petite feuille du bas, comme celles de la fiche client : posée sous
 * body (le piège du flou sur iPhone), elle prend le focus à l'ouverture (le
 * choix déjà fait, sinon le premier), le garde tant qu'elle est ouverte,
 * se ferme à Échap, et rend le focus à ce qui l'a ouverte.
 */
export function FeuilleMoyen({ titre, onClose, children }: { titre: string; onClose: () => void; children: ReactNode }) {
  // La mécanique partagée des feuilles (focus, Tab, Échap de la seule feuille du dessus, retour du focus),
  // avec le choix déjà fait comme premier arrêt.
  const ref = useFeuille(onClose, { verrou: true, premier: '[aria-checked="true"]' });
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet" role="dialog" aria-modal="true" aria-label={titre} ref={ref}>
          <div className="grab" />
          <div className="shd">
            <b>{titre}</b>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** « Payé sur place » : le moyen (le dernier du client par défaut), puis « C’est noté ». */
export function PayeSurPlaceSheet({ titre, defaut, onClose, onOk }: { titre: string; defaut?: PaymentMethod; onClose: () => void; onOk: (m: PaymentMethod, cheque: string) => void }) {
  const [m, setM] = useState<PaymentMethod | undefined>(defaut);
  const [chq, setChq] = useState("");
  const [demande, setDemande] = useState(false);
  return (
    <FeuilleMoyen titre={titre} onClose={onClose}>
      <div className="pad mp-form">
        <MoyenChoix value={m} onChange={(x) => (setM(x), setDemande(false))} cheque={chq} onCheque={setChq} demande={demande} />
        <button type="button" className="btn full" onClick={() => (m ? onOk(m, chq) : setDemande(true))}>
          C’est noté
        </button>
      </div>
    </FeuilleMoyen>
  );
}
