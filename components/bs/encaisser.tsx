"use client";

import { useMemo, useState } from "react";
import { Ic, eurc } from "@/components/carnet/ui";
import { MoyenChoix } from "@/components/bs/moyen-paiement";
import { JourChoix } from "@/components/bs/jour-paiement";
import { horodatage, jourDit } from "@/lib/domain/jour-paiement";
import { localToday } from "@/lib/utils/local-date";
import { useDataStore } from "@/stores/data-store";
import { accord, anciensEnMots, clientDues, duMois, prenomDe, type ClientDue } from "@/lib/domain/clients";
import { monthKey } from "@/lib/domain/billing";
import { dernierMoyen, enMoyen, suggestionsPartielles } from "@/lib/domain/paiement";
import { avanceDite, noterPaiement } from "@/components/bs/noter-paiement";
import { esc } from "@/components/bs/ui";
import { montantOuZero, saisieMontant } from "@/lib/utils/montant";
import { currentPeriod } from "@/lib/utils/period";
import type { PaymentMethod } from "@/lib/domain/types";
import { vibrer } from "@/lib/utils/vibrer";
import "@/app/carnet/client.css";

/**
 * « Un client m'a payé », depuis le + (Argent > Ça rentre) : la liste de ceux
 * qui te doivent, tous mois confondus, puis le même paiement que la fiche du
 * client : tout, une partie (champ vide, suggestions en puces), et comment.
 * Un paiement solde d'abord le mois le plus ancien (repartirPaiement). Rendu
 * dans la feuille du + ; `onDone` reçoit le message et de quoi l'annuler.
 */
export function Encaisser({ onBack, onDone }: { onBack: () => void; onDone: (html: string, undo: () => void) => void }) {
  const data = useDataStore();
  const period = useMemo(() => currentPeriod(), []);
  const doivent = useMemo(() => clientDues(data, period).filter((c) => c.due > 0), [data, period]);
  const [qui, setQui] = useState<ClientDue | null>(null);

  if (!qui)
    return (
      <>
        <button type="button" className="nt-bk" onClick={onBack}>
          <Ic n="back" className="" />
          Ça rentre
        </button>
        <p className="nt-pl">Qui t’a payé ?</p>
        {doivent.length ? (
          <div className="cl-rows nt-enc">
            {doivent.map((c) => (
              <button key={c.name} type="button" className="cl-row" onClick={() => setQui(c)}>
                <span className="ini" aria-hidden="true">
                  {c.name.trim().slice(0, 1).toUpperCase()}
                </span>
                <span className="cl-rt">
                  <b>{c.name}</b>
                  {c.anciens.length > 0 && <small>{anciensEnMots(c, period, eurc)}</small>}
                </span>
                <span className="cl-amt">
                  <small>te doit</small>
                  <b>{eurc(c.due)}</b>
                </span>
                <Ic n="chev" className="chev" />
              </button>
            ))}
          </div>
        ) : (
          <p className="note">Personne ne te doit d’argent pour l’instant.</p>
        )}
      </>
    );
  return <Payer c={qui} period={period} onBack={() => setQui(null)} onDone={onDone} />;
}

function Payer({ c, period, onBack, onDone }: { c: ClientDue; period: { year: number; month: number }; onBack: () => void; onDone: (html: string, undo: () => void) => void }) {
  const payments = useDataStore((s) => s.payments);
  const [moyen, setMoyen] = useState<PaymentMethod | undefined>(() => dernierMoyen(payments, c.name));
  const [cheque, setCheque] = useState("");
  const [demande, setDemande] = useState(false);
  const [partie, setPartie] = useState(false);
  const [v, setV] = useState("");
  const [today] = useState(localToday);
  const [jour, setJour] = useState(today);
  const Il = accord(c.name, "Il", "Elle");
  const val = montantOuZero(v);
  const payer = (montant: number) => {
    if (montant <= 0) return;
    if (!moyen) return setDemande(true);
    const ids = noterPaiement(c, montant, monthKey(period), { method: moyen, chequeNumber: cheque, at: horodatage(jour, today) });
    vibrer();
    onDone(`${esc(prenomDe(c.name))} t’a payé <strong>${eurc(montant)}</strong> ${enMoyen(moyen)}${jour !== today ? `, ${jourDit(jour, today)}` : ""}.${esc(avanceDite(c, montant))}`, () => {
      for (const id of ids) useDataStore.getState().removePayment(id);
    });
  };

  return (
    <>
      <button type="button" className="nt-bk" onClick={partie ? () => setPartie(false) : onBack}>
        <Ic n="back" className="" />
        {partie ? c.name : "Qui t’a payé ?"}
      </button>
      <div className="cl-pform">
        <span>
          <span className="cl-lab">{prenomDe(c.name)} te doit</span>
          <b className="cl-big">{eurc(c.due)}</b>
        </span>
        {c.anciens.length > 0 && <p className="note">{c.dueMois > 0 ? "Dont" : "C’est"} {c.anciens.map((a) => `${eurc(a.due)} ${duMois(a.month, period)}`).join(", ")}. Un paiement solde d’abord le plus ancien.</p>}
        {partie && (
          <>
            <p className="note">Combien {accord(c.name, "t’a-t-il", "t’a-t-elle")} payé ? Au-delà de ce qu’{accord(c.name, "il", "elle")} doit, c’est une avance.</p>
            <label className="input cl-amtin">
              <input type="text" inputMode="decimal" value={v} placeholder="0" autoFocus onChange={(e) => setV(saisieMontant(e.target.value))} onKeyDown={(e) => e.key === "Enter" && val > 0 && payer(val)} aria-label="Montant payé" />
              <span className="u">€</span>
            </label>
            <div className="chips">
              {suggestionsPartielles(c.due).map((x) => (
                <button key={x} type="button" className={`chip${val === x ? " on" : ""}`} aria-pressed={val === x} onClick={() => setV(String(x))}>
                  {eurc(x)}
                </button>
              ))}
            </div>
          </>
        )}
        <MoyenChoix
          value={moyen}
          onChange={(m) => {
            setMoyen(m);
            setDemande(false);
          }}
          cheque={cheque}
          onCheque={setCheque}
          demande={demande}
        />
        <JourChoix value={jour} onChange={setJour} today={today} />
        {partie ? (
          <button type="button" className="btn full" disabled={val <= 0} onClick={() => payer(val)}>
            C’est noté
          </button>
        ) : (
          <div className="cl-acts">
            <button type="button" className="btn" onClick={() => payer(c.due)}>
              {Il} a payé
            </button>
            <button type="button" className="btn line" onClick={() => setPartie(true)}>
              {Il} a payé une partie
            </button>
          </div>
        )}
      </div>
    </>
  );
}
