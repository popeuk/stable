"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { OBSTACLES, useSettingsStore, type ObstacleId } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";

/**
 * Le parcours de démarrage : six obstacles. Les trois premiers installent
 * l'écurie (chevaux, tarifs, factures communes), les trois suivants se
 * passent en utilisant l'app (cocher sa journée, ouvrir un ticket,
 * comprendre son seuil). Un obstacle passé ne se perd jamais.
 */
export const OBSTACLE_META: Record<ObstacleId, { title: string; todo: string; href: string; picto: string }> = {
  chevaux: { title: "Tes chevaux", todo: "Ajoute les chevaux que tu as en pension", href: "/parcours/chevaux", picto: "horse" },
  tarifs: { title: "Tes tarifs", todo: "Indique le prix de pension de chaque cheval", href: "/parcours/tarifs", picto: "euro" },
  factures: { title: "Tes frais communs", todo: "Foin, paille, loyer, salaires… à peu près, ça suffit", href: "/parcours/factures", picto: "foin" },
  journee: { title: "Ta première journée", todo: "Confirme 3 choses que tu as faites dans ta journée", href: "/planning", picto: "cal" },
  ticket: { title: "Ton premier ticket", todo: "Ouvre le ticket d’un cheval : ce qu’il rapporte et ce qu’il coûte", href: "/chevaux", picto: "jump" },
  seuil: { title: "Combien de chevaux il te faut", todo: "Découvre combien de chevaux il te faut pour ne pas perdre d’argent", href: "/seuil", picto: "flag" },
};

export function useParcours() {
  const parcours = useSettingsStore((s) => s.parcours);
  const passObstacle = useSettingsStore((s) => s.passObstacle);
  const arrived = useSettingsStore((s) => s.arrived);
  const setArrived = useSettingsStore((s) => s.setArrived);
  const say = useUiStore((s) => s.say);
  const router = useRouter();

  const n = OBSTACLES.filter((o) => parcours[o]).length;
  const current = OBSTACLES.find((o) => !parcours[o]) ?? null;
  const setupDone = parcours.chevaux && parcours.tarifs && parcours.factures;

  const pass = useCallback(
    (id: ObstacleId) => {
      if (!passObstacle(id)) return false;
      const after = OBSTACLES.filter((o) => (o === id ? true : useSettingsStore.getState().parcours[o])).length;
      if (after === 6 && !arrived) {
        setArrived();
        say(`Obstacle franchi : <strong>${OBSTACLE_META[id].title}</strong>. C’était la dernière étape.`);
        setTimeout(() => router.push("/parcours/arrivee"), 1100);
        return true;
      }
      say(`Obstacle franchi : <strong>${OBSTACLE_META[id].title}</strong>. ${after} étapes sur 6.`);
      return false;
    },
    [passObstacle, arrived, setArrived, say, router],
  );

  return { parcours, n, current, setupDone, pass };
}
