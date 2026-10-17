"use client";

import type { Horse } from "@/lib/domain/types";
import { Face, Ic } from "@/components/carnet/ui";

/**
 * Le seuil en têtes de chevaux : une case par box, les chevaux présents
 * dans leur robe, les boxes vides en creux, et un trait à l'encre là où les
 * frais communs sont payés. Styles : app/carnet/argent.css (sous .carnet).
 */
export function SeuilGrid({ horses, capacity, seuil }: { horses: Horse[]; capacity: number; seuil: number }) {
  const cap = Math.max(capacity, horses.length, isFinite(seuil) ? Math.ceil(seuil) : 0);
  const cols = 6;
  const ROW = 54; // une tête de 42 px et 12 px d'écart
  // Le trait passe entre deux têtes, au cheval entier : à 7,5 il coupait la 8e tête en deux.
  const sc = Math.min(isFinite(seuil) ? Math.ceil(seuil - 1e-9) : cap, cap);
  const row = Math.min(Math.floor(sc / cols), Math.ceil(cap / cols) - 1);
  const col = sc - row * cols;
  const free = Math.max(0, capacity - horses.length);
  return (
    <>
      <div className="ar-grid12" role="img" aria-label={isFinite(seuil) ? `${horses.length} chevaux sur ${cap} places. Il en faut ${Math.ceil(seuil - 1e-9)} pour ne pas perdre d’argent.` : `${horses.length} chevaux. Les pensions ne paient pas encore les soins.`}>
        {Array.from({ length: cap }, (_, i) => (horses[i] ? <Face key={i} horse={horses[i]} /> : <span key={i} className="ar-vide" />))}
        {isFinite(seuil) && (
          <span className="ar-trait" style={{ left: `calc(${((col / cols) * 100).toFixed(2)}% + 1px)`, top: row * ROW - 6 }}>
            <span>il en faut {Math.ceil(seuil - 1e-9)}</span>
          </span>
        )}
      </div>
      <div className="ar-glab">
        <span>
          {horses.length} cheva{horses.length > 1 ? "ux" : "l"} · {free} place{free > 1 ? "s" : ""} libre{free > 1 ? "s" : ""}
        </span>
        <b>
          <Ic n="flag" className="ar-ic" />
          {isFinite(seuil) ? "le trait : tout est payé" : "pas encore atteignable"}
        </b>
      </div>
    </>
  );
}
