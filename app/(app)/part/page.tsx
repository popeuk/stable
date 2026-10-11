"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Back, Screen, Tip, eur } from "@/components/bs/ui";
import { Picto, pictoForLabel } from "@/components/bs/picto";
import { HorseFace } from "@/components/bs/horse-face";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";

/** La part de l'écurie, expliquée une fois, avec les chiffres de l'écurie. */
export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <Part />
      </Suspense>
    </ClientGate>
  );
}

function Part() {
  const id = useSearchParams().get("id");
  const data = useDataStore();
  const capacity = useSettingsStore((s) => s.capacity);
  const m = useMemo(() => monthBreakdown(data, currentPeriod()), [data]);
  const horses = data.horses.filter((h) => !h.isArchived);
  const n = horses.length || 1;
  return (
    <Screen>
      <Back href={id ? `/ticket?id=${id}` : "/mois"}>{id ? "Retour au ticket" : "Le mois"}</Back>
      <h1 className="bs-d bs-t1" style={{ marginTop: 6 }}>
        La part de l’écurie, c’est quoi&nbsp;?
      </h1>
      <p className="bs-p">Les factures qui ne dépendent d’aucun cheval. On les partage entre ceux qui sont là.</p>
      <div style={{ marginTop: 12, background: "#fff", borderRadius: 10, boxShadow: "inset 0 0 0 1px var(--line)", padding: "6px 14px 10px" }}>
        {m.shared.map((x) => (
          <div key={x.label} className="bs-tl">
            <Picto name={pictoForLabel(x.label)} />
            <span>{x.label}</span>
            <b>{eur(x.amount)}</b>
          </div>
        ))}
        <div className="bs-tot" style={{ marginTop: 2 }}>
          <span>Ce mois</span>
          <b className="bs-num">{eur(m.sharedTotal)}</b>
        </div>
      </div>
      <div style={{ textAlign: "center", margin: "8px 0 4px", color: "var(--ink-3)" }}>
        <Picto name="down" size={20} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
        {horses.map((h) => (
          <HorseFace key={h.id} horse={h} size={32} />
        ))}
      </div>
      <p className="bs-num" style={{ textAlign: "center", fontWeight: 600, fontSize: 16.5, marginTop: 12 }}>
        {eur(m.sharedTotal)} ÷ {horses.length} chevaux ≈ {eur(m.sharedTotal / n)} chacun
      </p>
      {capacity > horses.length && (
        <p className="bs-p" style={{ textAlign: "center", marginTop: 4 }}>
          Avec tes {capacity} boxes pleins, ce ne serait plus que {eur(m.sharedTotal / capacity)} chacun.
        </p>
      )}
      <Tip>Une pension doit couvrir au moins sa part de l’écurie et les soins du cheval. Sinon, chaque mois, ce cheval te coûte.</Tip>
    </Screen>
  );
}
