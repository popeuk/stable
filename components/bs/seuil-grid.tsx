"use client";

import type { Horse } from "@/lib/domain/types";
import { HorseFace } from "@/components/bs/horse-face";
import { Picto } from "@/components/bs/picto";
import { dec1 } from "@/components/bs/ui";

/**
 * Le seuil en têtes de chevaux : une case par box, les chevaux présents
 * dans leur robe, les boxes vides en creux, et un trait rose là où les
 * factures communes sont payées.
 */
export function SeuilGrid({ horses, capacity, seuil }: { horses: Horse[]; capacity: number; seuil: number }) {
  const cap = Math.max(capacity, horses.length, isFinite(seuil) ? Math.ceil(seuil) : 0);
  const cols = 6;
  const sc = Math.min(isFinite(seuil) ? seuil : cap, cap);
  const row = Math.min(Math.floor(sc / cols), Math.ceil(cap / cols) - 1);
  const col = sc - row * cols;
  return (
    <>
      <div style={{ position: "relative", marginTop: 16, display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: "10px 4px", justifyItems: "center" }} role="img" aria-label={`${horses.length} chevaux, seuil à ${dec1(seuil)} chevaux`}>
        {Array.from({ length: cap }, (_, i) =>
          horses[i] ? <HorseFace key={i} horse={horses[i]} size={38} /> : <span key={i} className="bs-face" style={{ width: 38, height: 38, background: "#fff", boxShadow: "inset 0 0 0 1.5px var(--line)" }} />,
        )}
        {isFinite(seuil) && <div style={{ position: "absolute", left: `calc(${((col / cols) * 100).toFixed(2)}% + 1px)`, top: row * 48 - 4, height: 46, borderLeft: "3px solid var(--rose)" }} />}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--ink-3)", marginTop: 8 }}>
        <span>
          {horses.length} chevaux · {Math.max(0, capacity - horses.length)} boxes vides
        </span>
        <span style={{ color: "var(--ink-1)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          <Picto name="flag" size={15} />
          seuil : {dec1(seuil)}
        </span>
      </div>
    </>
  );
}
