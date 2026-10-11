"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, Sec, cap, dec1, eur, signed } from "@/components/bs/ui";
import { Picto, pictoForLabel } from "@/components/bs/picto";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { samePeriod, currentPeriod } from "@/lib/utils/period";

/** Le mois : ce qui rentre, ce qui sort, ce qui reste. Et le seuil. */
export default function Page() {
  return (
    <ClientGate>
      <Mois />
    </ClientGate>
  );
}

function Mois() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const step = usePeriodStore((s) => s.step);
  const m = useMemo(() => monthBreakdown(data, active), [data, active]);
  const isNow = samePeriod(active, currentPeriod());
  const label = cap(new Date(active.year, active.month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: isNow ? undefined : "numeric" }));
  const flow = (picto: string, l: string, a: number, out?: boolean) => (
    <div key={l} className="bs-li">
      <span className={`bs-pic ${out ? "rose" : ""}`}>
        <Picto name={picto} />
      </span>
      <span className="tx">
        <b>{l}</b>
      </span>
      <span className={`bs-amt ${out ? "" : "plus"}`}>{signed(out ? -a : a)}</span>
    </div>
  );
  return (
    <Screen>
      <div className="bs-over">
        <button type="button" className="bs-back" style={{ margin: 0, minHeight: 22 }} onClick={() => step(-1)} aria-label="Mois précédent">
          <Picto name="chevL" />
          Mois précédent
        </button>
        {!isNow && (
          <button type="button" className="bs-back" style={{ margin: 0, minHeight: 22 }} onClick={() => step(1)} aria-label="Mois suivant">
            Mois suivant
            <Picto name="chev" />
          </button>
        )}
      </div>
      <h1 className="bs-d bs-t1">{label}</h1>
      <div className="bs-card" style={{ marginTop: 12 }}>
        <span className="bs-pic soft">
          <Picto name="euro" />
        </span>
        <div style={{ flex: 1 }}>
          <div className="k">{m.net >= 0 ? "Il te reste, une fois tout payé" : "Il te manque, une fois tout payé"}</div>
          <div className={`bs-big${m.net < 0 ? " neg" : ""}`}>{signed(m.net)}</div>
        </div>
      </div>
      <Sec>Ce qui rentre · {eur(m.revenue)}</Sec>
      {m.ins.map((x) => flow(pictoForLabel(x.label), x.label, x.amount))}
      <Sec>Ce qui sort · {eur(m.direct + m.sharedTotal)}</Sec>
      {m.shared.map((x) => flow(pictoForLabel(x.label), x.label, x.amount, true))}
      {flow("fer", "Soins et frais des chevaux", m.direct, true)}
      <Link href="/seuil" className="bs-card">
        <span className="bs-pic soft">
          <Picto name="flag" />
        </span>
        <div style={{ flex: 1 }}>
          <div className="k">Ton seuil</div>
          <b>
            {isFinite(m.seuil) ? `${dec1(m.seuil)} chevaux paient tout · tu en as ${m.horseCount}` : "Tes pensions ne couvrent pas encore les soins"}
          </b>
        </div>
        <Picto name="arrowR" />
      </Link>
      <Link href="/part" className="bs-card" style={{ marginTop: 10 }}>
        <span className="bs-pic soft">
          <Picto name="foin" />
        </span>
        <div style={{ flex: 1 }}>
          <div className="k">La part de l’écurie</div>
          <b>Comment les factures communes se partagent</b>
        </div>
        <Picto name="arrowR" />
      </Link>
      <Sec>Aller plus loin</Sec>
      <Link href="/scenarios" className="bs-li tap">
        <span className="bs-pic">
          <Picto name="bulb" />
        </span>
        <span className="tx">
          <b>Et si…</b>
          <span>tester une hausse de pension, un box en plus</span>
        </span>
        <Picto name="chev" />
      </Link>
      <Link href="/pilotage" className="bs-li tap">
        <span className="bs-pic">
          <Picto name="chart" />
        </span>
        <span className="tx">
          <b>Le pilotage détaillé</b>
          <span>l’évolution sur plusieurs mois</span>
        </span>
        <Picto name="chev" />
      </Link>
      <Link href="/depenses" className="bs-li tap">
        <span className="bs-pic">
          <Picto name="tag" />
        </span>
        <span className="tx">
          <b>Toutes les dépenses</b>
          <span>la liste, pour corriger ou supprimer</span>
        </span>
        <Picto name="chev" />
      </Link>
    </Screen>
  );
}
