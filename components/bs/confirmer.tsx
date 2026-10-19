"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { FeuilleConfirmer } from "@/components/bs/effacer";

/**
 * Une question « oui ou non » posée dans une feuille de l'app, à la place de
 * window.confirm : pas d'adresse du site en tête, les insécables du reste de
 * l'écran, le même style que les autres feuilles (rendue dans document.body).
 *
 *   const [demander, feuille] = useConfirmer();
 *   if (await demander({ titre: "Arrêter cette rentrée d’argent ?", oui: "Oui, l’arrêter" })) …
 *   return <>{…}{feuille}</>;
 *
 * Sans `non`, la feuille n'a qu'un bouton (une information à lire).
 */
export type Question = { titre: string; texte?: ReactNode; oui: string; non?: string | null; danger?: boolean };

export function useConfirmer(): [(q: Question) => Promise<boolean>, ReactNode] {
  const [q, setQ] = useState<Question | null>(null);
  const reponse = useRef<((v: boolean) => void) | null>(null);
  const demander = useCallback(
    (question: Question) =>
      new Promise<boolean>((resolve) => {
        reponse.current?.(false);
        reponse.current = resolve;
        setQ(question);
      }),
    [],
  );
  const finir = (v: boolean) => {
    reponse.current?.(v);
    reponse.current = null;
    setQ(null);
  };
  const feuille = q ? (
    <FeuilleConfirmer titre={q.titre} onClose={() => finir(false)}>
      {q.texte && <p className="note">{q.texte}</p>}
      <button type="button" className={`btn full${q.danger ? " danger" : ""}`} onClick={() => finir(true)}>
        {q.oui}
      </button>
      {q.non !== null && (
        <button type="button" className="btn line full" onClick={() => finir(false)}>
          {q.non ?? "Non"}
        </button>
      )}
    </FeuilleConfirmer>
  ) : null;
  return [demander, feuille];
}
