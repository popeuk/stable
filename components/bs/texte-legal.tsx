"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Ic } from "@/components/carnet/ui";
import "@/app/carnet/registre.css";

/**
 * Les textes légaux (18 octobre 2026) : communs à l'app et à mon-ecurie.fr,
 * ils vivent sur le site. L'app en lit le texte seul (`?nu=1` : ni en-tête,
 * ni pied de page du site) et l'affiche dans son propre écran. Le site
 * l'autorise pour app.bestable.fr (CORS). On ne garde que les balises de
 * texte, sans style ni classe.
 */
export const SITE = "https://bestable.fr";
export const TEXTES = {
  confidentialite: { titre: "Confidentialité", chemin: "/confidentialite/" },
  cgu: { titre: "Conditions d’utilisation", chemin: "/cgu/" },
  "mentions-legales": { titre: "Mentions légales", chemin: "/mentions-legales/" },
} as const;
export type Texte = keyof typeof TEXTES;
export const estTexte = (t: string | null): t is Texte => !!t && t in TEXTES;

const GARDER = new Set(["DIV", "SECTION", "H2", "H3", "P", "UL", "OL", "LI", "STRONG", "EM", "A", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "BR"]);

/** Le texte du site, nettoyé : balises de texte seulement ; les liens vers un autre texte restent dans l'app. */
function nettoyer(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const passe = (el: Element) => {
    for (const c of Array.from(el.children)) {
      if (!GARDER.has(c.tagName)) {
        c.remove();
        continue;
      }
      const href = c.getAttribute("href");
      const libelle = c.getAttribute("data-l");
      for (const a of Array.from(c.attributes)) c.removeAttribute(a.name);
      if (libelle) c.setAttribute("data-l", libelle);
      if (c.tagName === "A" && href) {
        const cible = (Object.keys(TEXTES) as Texte[]).find((k) => href.startsWith(SITE + TEXTES[k].chemin));
        if (cible) {
          c.setAttribute("href", href);
          c.setAttribute("data-texte", cible);
        }
        else if (/^(https:|mailto:)/.test(href)) {
          c.setAttribute("href", href);
          if (href.startsWith("https:")) {
            c.setAttribute("target", "_blank");
            c.setAttribute("rel", "noreferrer");
          }
        }
      }
      passe(c);
    }
  };
  passe(doc.body);
  return doc.body.innerHTML;
}

const cache = new Map<Texte, string>();

/** Le texte lui-même. `onTexte` : un lien vers un autre texte a été touché. */
export function TexteLegal({ t, onTexte }: { t: Texte; onTexte: (t: Texte) => void }) {
  const [etat, setEtat] = useState<{ t: Texte; html: string | null; rate: boolean }>({ t, html: cache.get(t) ?? null, rate: false });
  useEffect(() => {
    if (cache.has(t)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEtat({ t, html: cache.get(t)!, rate: false });
      return;
    }
    let fini = false;
    setEtat({ t, html: null, rate: false });
    fetch(`${SITE}${TEXTES[t].chemin}?nu=1`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((h) => {
        const propre = nettoyer(h);
        cache.set(t, propre);
        if (!fini) setEtat({ t, html: propre, rate: false });
      })
      .catch(() => !fini && setEtat({ t, html: null, rate: true }));
    return () => {
      fini = true;
    };
  }, [t]);

  if (etat.rate)
    return (
      <div className="rg-vide">
        <p>Pas de réseau : le texte ne peut pas s’ouvrir.</p>
        <a className="btn" href={`${SITE}${TEXTES[t].chemin}`} target="_blank" rel="noreferrer">
          Le lire sur bestable.fr
        </a>
      </div>
    );
  if (!etat.html || etat.t !== t) return <div className="rg-vide" aria-busy="true">Chargement…</div>;
  return (
    <div
      className="rg-txt"
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest("a[data-texte]");
        if (!a) return;
        e.preventDefault();
        const cible = a.getAttribute("data-texte");
        if (estTexte(cible)) onTexte(cible);
      }}
      dangerouslySetInnerHTML={{ __html: etat.html }}
    />
  );
}

/** Un lien vers un texte, ouvert par-dessus l'écran (inscription : rien de ce qui est saisi ne se perd). */
export function LienLegal({ t, children }: { t: Texte; children: ReactNode }) {
  const [ouvert, setOuvert] = useState<Texte | null>(null);
  useEffect(() => {
    if (!ouvert) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [ouvert]);
  return (
    <>
      <a
        className="lnk"
        href={`${SITE}${TEXTES[t].chemin}`}
        onClick={(e) => {
          e.preventDefault();
          setOuvert(t);
        }}
      >
        {children}
      </a>
      {ouvert &&
        createPortal(
          <div className="carnet rg-voile" role="dialog" aria-modal="true" aria-label={TEXTES[ouvert].titre}>
            <div className="rg-feuille">
              <div className="rg-tete">
                <h2>{TEXTES[ouvert].titre}</h2>
                <button type="button" className="rg-fermer" onClick={() => setOuvert(null)} aria-label="Fermer">
                  <Ic n="x" className="" />
                </button>
              </div>
              <TexteLegal t={ouvert} onTexte={setOuvert} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
