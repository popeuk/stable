"use client";

import { useRouter } from "next/navigation";
import { TeteVerte } from "@/components/da/tete-verte";
import { Onglets } from "@/components/da/onglets";
import { Ic } from "@/components/carnet/ui";
import { useUiStore } from "@/stores/ui-store";
import { cap } from "@/components/bs/ui";
import { localToday } from "@/lib/utils/local-date";

type Vue = "planning" | "valider" | "taches";
const ROUTE: Record<Vue, string> = { planning: "/planning", valider: "/valider", taches: "/equipe" };

/**
 * Le haut du Planning, d'À valider et des Tâches (DA de l'app du Clos,
 * 27 novembre 2026) : l'en-tête vert (« Planning », la date du jour, le + rose
 * qui ajoute), puis les trois onglets en pastilles avec ce qui attend.
 */
export function PlanningTete({ vue, aValider, taches, aujourdhui, date }: { vue: Vue; aValider: number; taches: number; aujourdhui?: number; date?: string }) {
  const router = useRouter();
  const openNoter = useUiStore((s) => s.openNoter);
  const today = localToday();
  const jour = cap(new Date(today + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));
  return (
    <>
      <TeteVerte
        titre="Planning"
        sous={jour}
        action={
          <button type="button" className="da-plus" onClick={() => openNoter({ mode: "seance", date: date ?? today })} aria-label="Ajouter une séance, un soin ou une tâche">
            <Ic n="plus" className="" />
          </button>
        }
      />
      <Onglets
        label="Planning, à valider ou tâches"
        items={[
          { key: "planning", titre: "Agenda", petit: aujourdhui != null ? `${aujourdhui} aujourd’hui` : undefined, on: vue === "planning", go: () => vue !== "planning" && router.replace(ROUTE.planning, { scroll: false }) },
          { key: "valider", titre: "À valider", petit: `${aValider}`, point: aValider ? "var(--out)" : undefined, on: vue === "valider", go: () => vue !== "valider" && router.replace(ROUTE.valider, { scroll: false }) },
          { key: "taches", titre: "Tâches", petit: `${taches} ouverte${taches > 1 ? "s" : ""}`, on: vue === "taches", go: () => vue !== "taches" && router.replace(ROUTE.taches, { scroll: false }) },
        ]}
      />
    </>
  );
}
