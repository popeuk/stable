"use client";

import type { ReactNode } from "react";

/**
 * Les onglets d'une page en pastilles (DA de l'app du Clos) : un titre et,
 * dessous, un petit chiffre ; un point de couleur quand quelque chose attend.
 * Styles : app/da.css (.da-onglets).
 */
export function Onglets({ label, items }: { label: string; items: { key: string; titre: string; petit?: ReactNode; point?: string; on: boolean; go: () => void }[] }) {
  return (
    <div className="da-onglets" role="tablist" aria-label={label} style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map((it) => (
        <button key={it.key} type="button" role="tab" aria-selected={it.on} onClick={it.go}>
          <span className="t">{it.titre}</span>
          {it.petit != null && (
            <small>
              {it.point && <i style={{ background: it.point }} />}
              {it.petit}
            </small>
          )}
        </button>
      ))}
    </div>
  );
}
