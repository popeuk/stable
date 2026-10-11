"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Rosette, Screen, eur } from "@/components/bs/ui";
import { Picto } from "@/components/bs/picto";
import { SeuilGrid } from "@/components/bs/seuil-grid";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";

export default function Page() {
  return (
    <ClientGate>
      <Arrivee />
    </ClientGate>
  );
}

function Arrivee() {
  const data = useDataStore();
  const capacity = useSettingsStore((s) => s.capacity);
  const m = useMemo(() => monthBreakdown(data, currentPeriod()), [data]);
  const horses = data.horses.filter((h) => !h.isArchived);
  const need = isFinite(m.seuil) ? Math.ceil(m.seuil) : null;
  return (
    <Screen>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100dvh - 90px)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
          <Rosette lines={["Écurie", "prête"]} />
        </div>
        <h1 className="bs-d bs-t1" style={{ textAlign: "center", marginTop: 12 }}>
          Six barres sur six. Ton flot est gagné.
        </h1>
        <SeuilGrid horses={horses} capacity={capacity} seuil={m.seuil} />
        <p style={{ fontSize: 15, lineHeight: 1.5, marginTop: 14, textAlign: "center" }}>
          {need
            ? `Ton seuil : ${need} chevaux. Tu en as ${horses.length}${horses.length >= need ? ", tu passes" : `, il en manque ${need - horses.length}`}. Chaque box loué en plus te rapporte environ ${eur(m.contribution)} par mois.`
            : "Tes chevaux ne couvrent pas encore leurs propres soins : commence par revoir tes pensions."}
        </p>
        <div style={{ marginTop: "auto", paddingTop: 20 }}>
          <Link href="/accueil" className="bs-btn">
            Ouvrir ma journée <Picto name="arrowR" />
          </Link>
        </div>
      </div>
    </Screen>
  );
}
