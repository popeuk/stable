"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Ic } from "@/components/carnet/ui";
import { nonVues, useDemandes } from "@/lib/account/demandes";

/** La liste ne se charge qu'à l'ouverture (components/bs/demandes-feuille.tsx). */
const DemandesFeuille = dynamic(() => import("@/components/bs/demandes-feuille").then((m) => m.DemandesFeuille), { ssr: false });

/**
 * Les demandes des cavaliers (décision 13) : l'enveloppe en haut à droite
 * (et dans la barre latérale sur ordinateur), avec une pastille quand une
 * demande n'a pas été vue. Elle n'apparaît qu'avec un compte et quand le
 * site sait les donner (pc-bestable 1.5.0) ; sinon, rien.
 */
function useEnveloppe() {
  const path = usePathname();
  const etat = useDemandes((s) => s.etat);
  const charger = useDemandes((s) => s.charger);
  const n = useDemandes((s) => nonVues(s.demandes, s.vuesIci));
  useEffect(() => {
    void charger();
  }, [charger, path]);
  useEffect(() => {
    const revenir = () => document.visibilityState === "visible" && void charger();
    document.addEventListener("visibilitychange", revenir);
    return () => document.removeEventListener("visibilitychange", revenir);
  }, [charger]);
  return { visible: etat === "pret", n };
}

const etiquette = (n: number) => (n ? `Demandes des cavaliers : ${n} nouvelle${n > 1 ? "s" : ""}` : "Demandes des cavaliers");

/** L'enveloppe de l'en-tête (téléphone). */
export function EnveloppeBouton() {
  const { visible, n } = useEnveloppe();
  const [ouverte, setOuverte] = useState(false);
  if (!visible) return null;
  return (
    <>
      <button type="button" className="hd2-gear hd2-env" aria-label={etiquette(n)} onClick={() => setOuverte(true)}>
        <Ic n="mail" />
        {n > 0 && <span className="dm-pt" aria-hidden="true" />}
      </button>
      {ouverte && <DemandesFeuille onClose={() => setOuverte(false)} />}
    </>
  );
}

/** La même, en ligne de la barre latérale (ordinateur). */
export function EnveloppeLigne() {
  const { visible, n } = useEnveloppe();
  const [ouverte, setOuverte] = useState(false);
  if (!visible) return null;
  return (
    <>
      <button type="button" className="it dm-it" aria-label={etiquette(n)} onClick={() => setOuverte(true)}>
        <Ic n="mail" />
        <span style={{ flex: 1, minWidth: 0 }}>Demandes</span>
        {n > 0 && <span className="dm-pt" aria-hidden="true" />}
      </button>
      {ouverte && <DemandesFeuille onClose={() => setOuverte(false)} />}
    </>
  );
}
