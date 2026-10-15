"use client";

import Link from "next/link";
import { ClientGate } from "@/components/ui/client-gate";
import { cap } from "@/components/bs/ui";
import { Empty, Hello, Ic, Page, Sec, eur, sg } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { generateInsights } from "@/lib/domain/insights-engine";
import { formatMonthYear } from "@/lib/utils/format-date";

export default function DecouvertesPage() {
  return (
    <ClientGate>
      <Decouvertes />
    </ClientGate>
  );
}

function Decouvertes() {
  const data = useDataStore();
  const period = usePeriodStore((s) => s.active);
  const insights = generateInsights(data, period);

  return (
    <Page>
      <h1 className="ar-sr">Ce qu’on a remarqué</h1>
      <Hello title="Ce qu’on a remarqué" sub="Des choses repérées dans tes chiffres ce mois-ci. Touche une carte pour comprendre." />

      {insights.length === 0 ? (
        <Empty ill="dodo">
          <b>Rien de spécial ce mois-ci.</b> Continue à noter ce qui rentre et ce qui sort. Dès qu’on repère quelque chose d’utile, ça s’affiche ici.
        </Empty>
      ) : (
        <Sec ill="carnet-buste" title={cap(formatMonthYear(period))} action={<span className="act">{insights.length}</span>} delay={0.08}>
          {insights.map((insight, i) => (
            <Link key={insight.id} href={`/decouvertes/detail?id=${encodeURIComponent(insight.id)}`} className="card ar-ins rise" style={{ animationDelay: `${0.12 + i * 0.05}s`, marginLeft: 0, marginRight: 0 }}>
              <p className="mid" style={{ fontSize: 20 }}>
                {insight.title}
              </p>
              <p className="big num">{insight.keyMetricValue < 0 ? sg(insight.keyMetricValue) : eur(insight.keyMetricValue)}</p>
              <p className="note" style={{ marginTop: 2 }}>
                {insight.keyMetricLabel}
              </p>
              <p className="note ar-clamp">{insight.body}</p>
              <p className="lnk" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 10 }}>
                Comprendre
                <Ic n="chev" className="ar-ic" />
              </p>
            </Link>
          ))}
        </Sec>
      )}
      <div className="end" />
    </Page>
  );
}
