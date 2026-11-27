"use client";

import type { ReactNode } from "react";
import { Ic } from "@/components/carnet/ui";

export interface BarreMois {
  key: string;
  /** « oct. » */
  label: string;
  valeur: number;
  on: boolean;
  go: () => void;
}

/**
 * Le haut d'une fiche, client ou cheval (DA de l'app du Clos, repris le
 * 27 novembre 2026 de ~/Dreadsprint-v2/components/Fiche.tsx) : un aplat vert
 * pleine largeur qui prolonge la barre du haut. L'identité et son visuel, les
 * gestes rapides, puis le mois : une phrase, un grand chiffre, et six barres
 * pour les mois d'avant ; toucher une barre ouvre ce mois-là.
 * Le retour reste dans la barre du haut (components/bs/shell.tsx).
 * Styles : app/da.css (.da-fh).
 */
export function FicheHaut({
  visuel,
  titre,
  meta,
  gestes,
  mois,
  onPrec,
  onSuiv,
  suivBloque,
  phrase,
  chiffre,
  chiffreNeg,
  detail,
  barres,
}: {
  visuel: ReactNode;
  titre: string;
  meta?: ReactNode;
  gestes?: ReactNode;
  mois: string;
  onPrec: () => void;
  onSuiv: () => void;
  suivBloque?: boolean;
  phrase: ReactNode;
  chiffre: string;
  chiffreNeg?: boolean;
  detail?: ReactNode;
  barres: BarreMois[];
}) {
  const max = Math.max(1, ...barres.map((b) => Math.abs(b.valeur)));
  return (
    <header className="da-fh">
      <div className="da-fh-id">
        <div>
          <h1>{titre}</h1>
          {meta && <p className="da-fh-meta">{meta}</p>}
        </div>
        <div className="da-fh-visuel">{visuel}</div>
      </div>
      {gestes && <div className="da-fh-gestes">{gestes}</div>}

      <div className="da-fh-mois">
        <div className="da-fh-nav">
          <button type="button" onClick={onPrec} aria-label="Mois précédent">
            <Ic n="chevL" className="" />
          </button>
          <span>{mois}</span>
          <button type="button" onClick={onSuiv} disabled={suivBloque} aria-label="Mois suivant">
            <Ic n="chev" className="" />
          </button>
        </div>
        <p className="da-fh-phrase">{phrase}</p>
        <p className={`da-fh-chiffre${chiffreNeg ? " neg" : ""}`}>{chiffre}</p>
        {detail && <p className="da-fh-detail">{detail}</p>}
        <div className="da-fh-barres" role="group" aria-label="Les six derniers mois">
          {barres.map((b) => (
            <button key={b.key} type="button" className={`${b.on ? "on" : ""}${b.valeur < 0 ? " neg" : ""}`} onClick={b.go} aria-label={`${b.label} : ${Math.round(b.valeur)} €`} aria-pressed={b.on}>
              <span className="col">
                <i style={{ height: `${Math.max(4, (Math.abs(b.valeur) / max) * 100)}%` }} />
              </span>
              <small>{b.label}</small>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
