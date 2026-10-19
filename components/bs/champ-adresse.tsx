"use client";

import { useEffect, useId, useRef, useState, type FocusEvent } from "react";
import { Ic } from "@/components/carnet/ui";
import { adresseEcrite, assezPourChercher, chercherAdresses, type Suggestion } from "@/lib/adresses-ign";
import "@/app/carnet/adresse.css";

/**
 * Un champ d'adresse qui propose les adresses de la Base Adresse Nationale
 * (IGN) pendant la frappe. Les propositions s'affichent sous le champ, dans
 * le flux de la page, comme le choix du propriétaire : rien ne flotte
 * par-dessus l'écran (sur iPhone, un panneau ouvert dans une zone floutée
 * reste enfermé dedans). Toucher une proposition écrit l'adresse ; sans
 * réseau, ou pour un lieu-dit absent de la base, on tape comme avant.
 *
 * - `onChange` : à chaque lettre et au choix d'une proposition.
 * - `onCommit` : en quittant le champ et au choix d'une proposition
 *   (pour les champs qui s'enregistrent quand on les quitte).
 * - `surUneLigne` : un `input` et « rue, code postal ville » ; sinon une
 *   zone de texte et l'adresse sur deux lignes, comme sur une facture.
 * - `communes` : ne propose que des communes ; avec `onChoisir`, le
 *   formulaire range lui-même le code postal et la ville.
 */
export function ChampAdresse({
  value,
  defaultValue = "",
  onChange,
  onCommit,
  onChoisir,
  communes = false,
  surUneLigne = false,
  rows = 2,
  placeholder,
  className = "input",
  autoComplete = "off",
  ariaLabel,
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  onCommit?: (v: string) => void;
  onChoisir?: (s: Suggestion) => void;
  communes?: boolean;
  surUneLigne?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
  autoComplete?: string;
  ariaLabel?: string;
}) {
  const [interne, setInterne] = useState(defaultValue);
  const texte = value ?? interne;
  const [props, setProps] = useState<Suggestion[]>([]);
  // On ne cherche que ce que la personne vient de taper, pas une adresse
  // déjà enregistrée ou une proposition qu'elle vient de choisir.
  const [tape, setTape] = useState(false);
  const boite = useRef<HTMLDivElement>(null);
  const uid = useId();

  useEffect(() => {
    if (!tape || !assezPourChercher(texte)) return;
    const ctrl = new AbortController();
    // Une courte pause dans la frappe avant de demander : une requête par mot, pas par lettre.
    const t = setTimeout(() => {
      chercherAdresses(texte, { signal: ctrl.signal, communes }).then((l) => {
        if (!ctrl.signal.aborted) setProps(l);
      });
    }, 280);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [texte, tape, communes]);

  const ecrire = (v: string) => {
    if (value === undefined) setInterne(v);
    onChange?.(v);
  };
  const taper = (v: string) => {
    setTape(true);
    ecrire(v);
  };
  const choisir = (s: Suggestion) => {
    setTape(false);
    setProps([]);
    if (onChoisir) return onChoisir(s);
    const v = adresseEcrite(s, surUneLigne);
    ecrire(v);
    onCommit?.(v);
  };
  // Quitter le champ pour toucher une proposition ne compte pas comme le quitter.
  const quitter = (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (boite.current?.contains(e.relatedTarget as Node | null)) return;
    setTape(false);
    onCommit?.(e.target.value.trim());
  };

  // Les dernières propositions restent le temps que les suivantes arrivent.
  const liste = tape && assezPourChercher(texte) && props.length > 0;
  const commun = {
    className,
    value: texte,
    placeholder,
    autoComplete,
    "aria-label": ariaLabel,
    "aria-describedby": liste ? `${uid}-l` : undefined,
    onBlur: quitter,
  };
  return (
    <div className="adr" ref={boite}>
      {surUneLigne ? (
        <input {...commun} onChange={(e) => taper(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setTape(false)} />
      ) : (
        <textarea {...commun} className={`${className} ta fa-adr`} rows={rows} onChange={(e) => taper(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setTape(false)} />
      )}
      {liste && (
        <div className="adr-list" id={`${uid}-l`} role="group" aria-label={communes ? "Communes proposées" : "Adresses proposées"}>
          {props.map((s) => (
            <button key={`${s.rue}|${s.commune}`} type="button" className="adr-c" onMouseDown={(e) => e.preventDefault()} onClick={() => choisir(s)}>
              <Ic n="pin" className="" />
              <span>
                {s.rue || s.commune}
                {s.rue && <small>{s.commune}</small>}
              </span>
            </button>
          ))}
          <small className="adr-src">Base Adresse Nationale (IGN)</small>
        </div>
      )}
    </div>
  );
}
