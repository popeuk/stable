"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Ic, eur } from "@/components/carnet/ui";
import { Chiffres } from "@/components/da/tete-verte";
import { AValiderCarte } from "@/components/da/a-valider";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { usePeriodStore } from "@/stores/period-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { tvaDuMois } from "@/lib/domain/tva";
import { currentPeriod, samePeriod } from "@/lib/utils/period";

/**
 * Le haut du Suivi, dans le vert (repris de l'app du Clos, SuiviLayer et
 * ObjectifDuMois, le 27 novembre 2026) : l'objectif du mois avec ses
 * flèches, ce qui attend d'être validé, puis trois chiffres TTC (chiffre
 * d'affaires, frais, TVA à reverser). Un taux de TVA qui manque est dit,
 * jamais deviné. Styles : app/da.css (.da-ob).
 */
export function SuiviTete() {
  const data = useDataStore();
  const objective = useSettingsStore((s) => s.objective);
  const objectiveCa = useSettingsStore((s) => s.objectiveCa);
  const active = usePeriodStore((s) => s.active);
  const step = usePeriodStore((s) => s.step);
  const now = currentPeriod();
  const ceMois = samePeriod(active, now);
  const m = useMemo(() => monthBreakdown(data, active), [data, active]);
  const tva = useMemo(() => tvaDuMois(data, active), [data, active]);

  const nom = new Date(active.year, active.month - 1, 15).toLocaleDateString("fr-FR", { month: "long" });
  const deMois = `${/^[aeiouy]/i.test(nom) ? "d’" : "de "}${nom}${active.year !== now.year ? ` ${active.year}` : ""}`;
  const fin = new Date(active.year, active.month, 0).getDate();
  const reste = fin - new Date().getDate();
  // Le chiffre visé d'abord (comme au Clos) ; sinon ce qui doit rester ; sinon rien de visé.
  const ca = m.revenue;
  const vise = objectiveCa > 0 ? { fait: ca, cible: objectiveCa, mot: "réalisés" } : objective > 0 ? { fait: m.net, cible: objective, mot: m.net < 0 ? "manquent" : "te restent" } : null;
  const pct = vise ? Math.max(0, Math.min(100, Math.round((vise.fait / vise.cible) * 100))) : 0;
  const peutFixer = !ceMois ? active.year * 12 + active.month > now.year * 12 + now.month : true;

  return (
    <>
      <div className={`da-ob${vise ? "" : " sans"}`}>
        <div className="da-ob-nav">
          <button type="button" onClick={() => step(-1)} aria-label="Mois précédent">
            <Ic n="chevL" className="" />
          </button>
          <span>Objectif {deMois}</span>
          <button type="button" onClick={() => step(1)} disabled={ceMois} aria-label="Mois suivant">
            <Ic n="chev" className="" />
          </button>
          {!ceMois && (
            <button type="button" className="da-ob-auj" onClick={() => step(now.year * 12 + now.month - (active.year * 12 + active.month))}>
              Ce mois-ci
            </button>
          )}
        </div>
        <Link href="/argent?objectif=1#objectifs" className="da-ob-corps" aria-label="Voir et fixer mes objectifs du mois">
          <span className="da-ob-fig">
            <b>{eur(Math.round(Math.abs(vise ? vise.fait : ca)))}</b>
            <small>{vise ? `${vise.mot} sur ${eur(vise.cible)}` : "réalisés, sans objectif"}</small>
            {vise && <em>{pct} %</em>}
          </span>
          <span className="da-ob-barre">
            <i style={{ width: `${pct}%` }} />
          </span>
          <span className="da-ob-bas">
            <span>{!vise ? (peutFixer ? "Pas encore d’objectif" : "Pas d’objectif ce mois-là") : ceMois ? `Encore ${reste} jour${reste > 1 ? "s" : ""} ce mois-ci` : "Mois terminé"}</span>
            <span className="da-ob-voir">
              {!vise && peutFixer ? "Fixer mon objectif" : "Voir"} <Ic n="arrow" className="" />
            </span>
          </span>
        </Link>
      </div>
      {ceMois && <AValiderCarte dansLeVert />}
      <Chiffres
        items={[
          { n: eur(Math.round(tva.caTTC)), l: "de CA TTC", href: "/argent" },
          { n: eur(Math.round(tva.fraisTTC)), l: "de frais TTC", href: "/argent?vue=mouvements" },
          tva.recettesSansTaux > 0
            ? { n: "?", l: "TVA : taux à dire", href: "/prestations" }
            : { n: eur(Math.abs(Math.round(tva.aReverser))), l: tva.aReverser >= 0 ? "de TVA à reverser" : "de TVA à récupérer" },
        ]}
      />
      {tva.recettesSansTaux === 0 && tva.fraisSansTaux > 0 && <p className="da-tva-note">Des frais n’ont pas de taux de TVA : leur TVA n’est pas déduite.</p>}
    </>
  );
}
