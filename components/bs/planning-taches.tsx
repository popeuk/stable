"use client";

import { useRouter } from "next/navigation";
import { Seg } from "@/components/carnet/ui";

type Vue = "planning" | "valider" | "taches";
const ROUTE: Record<Vue, string> = { planning: "/planning", valider: "/valider", taches: "/equipe" };

/**
 * Le sélecteur Planning · À valider · Tâches, en haut des trois écrans
 * (27 novembre 2026, repris de l'app du Clos) : Planning ouvre /planning,
 * À valider /valider (les séances passées qui attendent), Tâches /equipe.
 * L'onglet Planning de la barre du bas reste allumé sur les trois.
 */
export function PlanningTaches({ value, count, aValider }: { value: Vue; count?: number; aValider?: number }) {
  const router = useRouter();
  return (
    <Seg<Vue>
      value={value}
      onChange={(v) => v !== value && router.replace(ROUTE[v], { scroll: false })}
      label="Planning, à valider ou tâches"
      options={[
        ["planning", "Planning"],
        ["valider", aValider ? `À valider · ${aValider}` : "À valider"],
        ["taches", count ? `Tâches · ${count}` : "Tâches"],
      ]}
    />
  );
}

/** Téléphone : le sélecteur collé en haut de l'écran, comme Clients · Chevaux. */
export function PlanningTachesHaut(props: { value: Vue; count?: number; aValider?: number }) {
  return (
    <div className="ch-cchd">
      <PlanningTaches {...props} />
    </div>
  );
}
