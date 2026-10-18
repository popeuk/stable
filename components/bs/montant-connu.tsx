"use client";

import { eurc } from "@/components/carnet/ui";
import { FOIS_PROPOSES, parAn, parMois, type Connu } from "@/lib/domain/montant-saisi";

/**
 * Comment le gérant connaît un frais qui revient : par mois, par an, ou en
 * plusieurs fois dans l'année. Trois gros boutons, puis l'équivalent par mois
 * en clair. La répartition elle-même vit dans lib/domain/montant-saisi.ts.
 */
export const CONNU_OPTIONS: [Connu, string][] = [
  ["mois", "Par mois"],
  ["an", "Par an"],
  ["fois", "En plusieurs fois"],
];

/** L'unité au bout du champ. */
export const uniteConnu = (mode: Connu) => (mode === "an" ? "€ / an" : mode === "fois" ? "€ chaque fois" : "€ / mois");

/** La petite ligne sous le nom d'un poste. */
export const ligneConnu = (mode: Connu, fois: number) => (mode === "an" ? "par an, à peu près" : mode === "fois" ? `à chaque fois, ${fois} fois dans l’année` : "par mois, à peu près");

export function ChoixConnu({ value, onChange, label = "Tu le paies", sansTitre }: { value: Connu; onChange: (v: Connu) => void; label?: string; sansTitre?: boolean }) {
  return (
    <div className="mc" role="group" aria-label={label}>
      {!sansTitre && <p className="mc-k">{label}</p>}
      <div className="mc-3">
        {CONNU_OPTIONS.map(([k, l]) => (
          <button key={k} type="button" className={value === k ? "on" : ""} aria-pressed={value === k} onClick={() => onChange(k)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChoixFois({ fois, onChange }: { fois: number; onChange: (n: number) => void }) {
  return (
    <div className="mc" role="group" aria-label="Combien de fois dans l’année">
      <p className="mc-k">Combien de fois dans l’année</p>
      <div className="mc-4">
        {FOIS_PROPOSES.map((n) => (
          <button key={n} type="button" className={fois === n ? "on" : ""} aria-pressed={fois === n} onClick={() => onChange(n)}>
            {n} fois
          </button>
        ))}
      </div>
    </div>
  );
}

/** « Soit 250 € par mois » : rien quand le montant est déjà par mois. */
export function SoitParMois({ mode, montant, fois }: { mode: Connu; montant: number; fois: number }) {
  if (mode === "mois" || !(montant > 0)) return null;
  return (
    <p className="mc-soit" aria-live="polite">
      {mode === "fois" && <>{fois} fois {eurc(montant)}, c’est {eurc(parAn(mode, montant, fois))} sur l’année. </>}
      Soit <b>{eurc(parMois(mode, montant, fois))} par mois</b> : l’app le répartit sur les mois.
    </p>
  );
}
