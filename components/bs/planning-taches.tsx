"use client";

import { useRouter } from "next/navigation";
import { Seg } from "@/components/carnet/ui";

type Vue = "planning" | "taches";

/**
 * Le sélecteur Planning · Tâches, en haut des deux écrans : Planning ouvre
 * /planning, Tâches ouvre /equipe (les tâches de l'équipe). L'onglet
 * Planning de la barre du bas reste allumé sur les deux.
 */
export function PlanningTaches({ value, count }: { value: Vue; count?: number }) {
  const router = useRouter();
  return (
    <Seg<Vue>
      value={value}
      onChange={(v) => v !== value && router.replace(v === "planning" ? "/planning" : "/equipe", { scroll: false })}
      label="Planning ou tâches"
      options={[
        ["planning", "Planning"],
        ["taches", count ? `Tâches · ${count}` : "Tâches"],
      ]}
    />
  );
}

/** Téléphone : le sélecteur collé en haut de l'écran, comme Clients · Chevaux. */
export function PlanningTachesHaut(props: { value: Vue; count?: number }) {
  return (
    <div className="ch-cchd">
      <PlanningTaches {...props} />
    </div>
  );
}
