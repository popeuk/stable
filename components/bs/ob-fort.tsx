"use client";

import { useEffect, useMemo, useState } from "react";
import { eurc, sg } from "@/components/carnet/ui";
import { estAMoi, fraisDuMois } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";

/**
 * L'arrivée tenue (proposition du 18 octobre 2026, derrière ?v=n ; ?v=0
 * revient à l'actuel). Les mêmes écrans, les mêmes mots, les mêmes
 * dessins, rangés comme le reste de l'app : chaque partie dans une case
 * blanche tenue par un filet, chaque dessin posé sur le bord de sa case,
 * une seule marge de 16 px. En pied de la case de chaque question, une
 * ligne montre le mois qui se dessine. Le choix suit tout le parcours
 * dans l'onglet. Styles : app/carnet/ob-fort.css.
 */
export type ObV = "n" | null;
const CLE = "be-stable-ob-v";

export function useObV(): ObV {
  const [v, setV] = useState<ObV>(null);
  useEffect(() => {
    let x: string | null = new URLSearchParams(window.location.search).get("v");
    try {
      if (x === "0") {
        sessionStorage.removeItem(CLE);
        x = null;
      } else if (x === "n") sessionStorage.setItem(CLE, x);
      else x = sessionStorage.getItem(CLE);
    } catch {}
    const ok: ObV = x === "n" ? "n" : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setV(ok);
    if (ok) document.documentElement.dataset.ob = ok;
    else delete document.documentElement.dataset.ob;
  }, []);
  return v;
}

/** Ce qu'une question a déjà en main sans l'avoir enregistré (le nombre et la pension tapés). */
export interface Apercu {
  chevaux?: number;
  pension?: number;
}

/** Le mois tel qu'il se dessine, avec ce que la question en cours a déjà tapé. */
export function useMoisVivant(apercu?: Apercu) {
  const data = useDataStore();
  const ac = apercu?.chevaux;
  const ap = apercu?.pension;
  return useMemo(() => {
    const m = monthBreakdown(data, currentPeriod());
    const enPension = data.horses.filter((h) => !h.isArchived && !estAMoi(h)).length;
    const f = fraisDuMois(data);
    const frais = f.total + f.postes;
    const pension = ap ?? data.tariffs?.pension ?? 0;
    const chevaux = ac ?? enPension;
    // Avant le premier enregistrement, le mois vient de ce qui est tapé.
    const net = enPension === 0 && ac ? ac * (ap ?? 0) - m.sharedTotal : Math.round(m.net);
    return { net, chevaux, pension, frais };
  }, [data, ac, ap]);
}

/** Le pied de la case d'une question : le mois qui se dessine, en une ligne. */
export function MoisLigne({ apercu }: { apercu?: Apercu }) {
  const { net, chevaux, pension, frais } = useMoisVivant(apercu);
  if (!chevaux || !pension)
    return (
      <p className="obn-mois obn-mois-vide" aria-live="polite">
        Ton mois se calcule ici, réponse après réponse.
      </p>
    );
  return (
    <p className="obn-mois" aria-live="polite">
      <span>
        {chevaux} pension{chevaux > 1 ? "s" : ""} à {eurc(pension)}
        {frais > 0 && <>, moins {eurc(frais)} de frais</>}
      </span>
      <b className="num">
        {sg(net)}
        <small> par mois</small>
      </b>
    </p>
  );
}
