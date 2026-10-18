"use client";

import type { Horse } from "@/lib/domain/types";
import { Face, Ic } from "@/components/carnet/ui";

/**
 * Le seuil en têtes de chevaux : une case par box, les chevaux présents
 * dans leur robe, les boxes vides en creux, et un trait à l'encre là où les
 * frais communs sont payés. Styles : app/carnet/argent.css (sous .carnet).
 */
export function SeuilGrid({ horses, miens = [], capacity, seuil, horsPlaces }: { horses: Horse[]; miens?: Horse[]; capacity: number; seuil: number; horsPlaces?: boolean }) {
  // Les pensions d'abord, les places libres, puis les chevaux du gérant au bout. Jamais de place qui n'existe pas.
  const tous = horses.length + miens.length;
  const cap = capacity > 0 ? Math.max(capacity, tous) : Math.max(tous, isFinite(seuil) ? Math.ceil(seuil) + miens.length : 0);
  const vides = Math.max(0, cap - tous);
  const cases = [...horses.map((h) => ({ h })), ...Array.from({ length: vides }, () => ({ h: undefined as Horse | undefined })), ...miens.map((h) => ({ h }))];
  const cols = 6;
  const ROW = 54; // une tête de 42 px et 12 px d'écart
  // Le trait passe entre deux têtes, au cheval entier : à 7,5 il coupait la 8e tête en deux.
  const sc = Math.min(isFinite(seuil) ? Math.ceil(seuil - 1e-9) : cap, cap);
  const row = Math.min(Math.floor(sc / cols), Math.ceil(cap / cols) - 1);
  const col = sc - row * cols;
  const free = Math.max(0, capacity - tous);
  const n = horses.length;
  const aria = horsPlaces
    ? `${n} pension${n > 1 ? "s" : ""} sur ${cap} places. Même toutes pleines, les pensions ne paient pas tout.`
    : isFinite(seuil)
      ? `${n} pension${n > 1 ? "s" : ""} sur ${cap} places. Il en faut ${Math.ceil(seuil - 1e-9)} pour ne pas perdre d’argent.`
      : `${n} pension${n > 1 ? "s" : ""}. Les pensions ne paient pas encore les soins.`;
  return (
    <>
      <div className="ar-grid12" role="img" aria-label={aria}>
        {cases.map((c, i) => (c.h ? <Face key={i} horse={c.h} /> : <span key={i} className="ar-vide" />))}
        {isFinite(seuil) && (
          <span className="ar-trait" style={{ left: `calc(${((col / cols) * 100).toFixed(2)}% + 1px)`, top: row * ROW - 6 }}>
            <span>il en faut {Math.ceil(seuil - 1e-9)}</span>
          </span>
        )}
      </div>
      <div className="ar-glab">
        <span>
          {n} pension{n > 1 ? "s" : ""}
          {miens.length ? ` · ${miens.length} à toi` : ""} · {free} place{free > 1 ? "s" : ""} libre{free > 1 ? "s" : ""}
        </span>
        <b>
          <Ic n="flag" className="ar-ic" />
          {horsPlaces ? "pas assez de places à ce prix" : isFinite(seuil) ? "le trait : tout est payé" : "pas encore atteignable"}
        </b>
      </div>
    </>
  );
}
