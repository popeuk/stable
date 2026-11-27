"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Ic, eur } from "@/components/carnet/ui";
import { useBriques } from "@/components/bs/briques";
import { estOuverte } from "@/lib/briques";
import { useDataStore } from "@/stores/data-store";
import { aValider } from "@/lib/domain/compte-auto";
import { localToday } from "@/lib/utils/local-date";

const maintenant = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * Ce qui attend d'être validé (DA de l'app du Clos) : une carte rose, le
 * nombre en grand, ce que ça ajoutera au décompte, et le chemin vers
 * Planning, À valider. Rien quand rien n'attend. Sur l'Accueil, et dans la
 * tête verte du Suivi (`dansLeVert`). Styles : app/da.css (.da-a-valider).
 */
export function AValiderCarte({ dansLeVert }: { dansLeVert?: boolean }) {
  const { etat } = useBriques();
  const ouverte = estOuverte(etat.planning);
  const data = useDataStore();
  const ready = useDataStore((s) => s.hydrated);
  const today = localToday();
  const jours = useMemo(() => (ouverte && ready ? aValider(data, today, maintenant()) : []), [data, today, ouverte, ready]);
  const n = jours.reduce((t, j) => t + j.seances.length, 0);
  const total = jours.reduce((t, j) => t + j.total, 0);
  if (!n) return null;
  return (
    <Link href="/valider" className={`da-a-valider rise${dansLeVert ? " dans-vert" : ""}`} style={{ animationDelay: ".12s" }}>
      <b>{n}</b>
      <span>
        <strong>séance{n > 1 ? "s" : ""} à valider</strong>
        <small>{total > 0 ? `+${eur(total)} au décompte une fois validée${n > 1 ? "s" : ""}` : "Dans le Planning, onglet À valider"}</small>
      </span>
      <Ic n="arrow" className="" />
    </Link>
  );
}
