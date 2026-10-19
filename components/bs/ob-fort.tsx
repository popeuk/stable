"use client";

import { useMemo } from "react";
import { eurc, sg } from "@/components/carnet/ui";
import { estAMoi, fraisDuMois } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";

/**
 * L'arrivée tenue (18 octobre 2026) : chaque partie dans une case blanche
 * tenue par un filet, chaque dessin posé sur le bord de sa case, une seule
 * marge de 16 px. En pied de la case de chaque question, une ligne montre le
 * mois qui se dessine. Styles : app/carnet/ob-fort.css.
 */

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
        Ton bilan se calcule ici, réponse après réponse.
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
