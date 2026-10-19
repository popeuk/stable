"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { OBSTACLES, useSettingsStore, type ObstacleId } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";

/* Ce que l'accueil lit du parcours (components/bs/parcours.ts redonne tout ceci). */

/**
 * Le parcours de démarrage : six obstacles. Les trois premiers installent
 * l'écurie (chevaux, tarifs, factures communes), les trois suivants se
 * passent en utilisant l'app (cocher sa journée, ouvrir un ticket,
 * comprendre son seuil). Un obstacle passé ne se perd jamais.
 */
export const OBSTACLE_META: Record<ObstacleId, { title: string; todo: string; href: string; picto: string }> = {
  chevaux: { title: "Tes chevaux", todo: "Combien de chevaux sont chez toi", href: "/parcours/chevaux", picto: "horse" },
  tarifs: { title: "Tes prix", todo: "Le prix de la pension et de tes cours", href: "/parcours/tarifs", picto: "euro" },
  factures: { title: "Les frais de l’écurie", todo: "Foin, paille, loyer, salaires… à peu près, ça suffit", href: "/parcours/factures", picto: "foin" },
  journee: { title: "Ta première journée", todo: "Trois choses qui comptent dans ta journée", href: "/planning", picto: "cal" },
  ticket: { title: "Ouvrir la fiche d’un cheval", todo: "Ouvre la fiche d’un cheval : ce qu’il rapporte et ce qu’il coûte", href: "/chevaux", picto: "jump" },
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

  /** `passee` : l'étape est sautée sans rien remplir. Le message le dit, sans bravo. */
  const pass = useCallback(
    (id: ObstacleId, passee = false) => {
      if (!passObstacle(id)) return false;
      const after = OBSTACLES.filter((o) => (o === id ? true : useSettingsStore.getState().parcours[o])).length;
      if (after === 6 && !arrived) {
        setArrived();
        say(`C’est fait : <strong>${OBSTACLE_META[id].title}</strong>. C’était la dernière.`);
        setTimeout(() => router.push("/parcours/arrivee"), 1100);
        return true;
      }
      say(passee ? `Mis de côté : <strong>${OBSTACLE_META[id].title}</strong>. Tu y reviens quand tu veux depuis Tes premiers pas.` : `C’est fait : <strong>${OBSTACLE_META[id].title}</strong>.`);
      return false;
    },
    [passObstacle, arrived, setArrived, say, router],
  );

  return { parcours, n, current, setupDone, pass };
}

/**
 * Les chevaux du gérant : ils prennent une place et leur part des frais de
 * l'écurie, sans pension. Marqués par leur formule (« À moi », synchronisée
 * comme les autres formules), ils ne sont jamais comptés comme une pension
 * qui manque.
 */
export const A_MOI = "À moi";
export const estAMoi = (h: { pensionType?: string }) => h.pensionType === A_MOI;
