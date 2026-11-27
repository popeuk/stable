import type { ReactNode } from "react";

/**
 * L'en-tête vert des pages d'onglet (DA de l'app du Clos, 27 novembre 2026) :
 * le titre, une phrase, une action à droite (le + rose), puis ce qui compte
 * le plus sur la page (chiffres, objectif, fiche). Il prolonge la barre du
 * haut, verte elle aussi sur ces pages (components/bs/shell.tsx, .da-vert).
 * Jamais sur l'Accueil. Styles : app/da.css (.da-tete).
 */
export function TeteVerte({ titre, sous, action, children }: { titre: string; sous?: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <header className="da-tete">
      <div className="da-tete-h">
        <div>
          <h1>{titre}</h1>
          {sous && <p>{sous}</p>}
        </div>
        {action}
      </div>
      {children}
    </header>
  );
}

/** Des chiffres côte à côte dans le vert ; `chaud` met en rose celui qui attend un geste. */
export function Chiffres({ items }: { items: { n: ReactNode; l: string; chaud?: boolean; href?: string }[] }) {
  return (
    <div className="da-chiffres">
      {items.map((it) =>
        it.href ? (
          <a key={it.l} href={it.href} className={it.chaud ? "chaud" : undefined}>
            <b>{it.n}</b>
            <span>{it.l}</span>
          </a>
        ) : (
          <div key={it.l} className={it.chaud ? "chaud" : undefined}>
            <b>{it.n}</b>
            <span>{it.l}</span>
          </div>
        ),
      )}
    </div>
  );
}
