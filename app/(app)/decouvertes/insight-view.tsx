"use client";

import Link from "next/link";
import { ClientGate } from "@/components/ui/client-gate";
import { CountUp, Empty, Hello, Page, Tip, eur, sg } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { generateInsights } from "@/lib/domain/insights-engine";

export function InsightView({ id }: { id: string }) {
  return (
    <ClientGate>
      <InsightDetail id={id} />
    </ClientGate>
  );
}

function InsightDetail({ id }: { id: string }) {
  const data = useDataStore();
  const period = usePeriodStore((s) => s.active);
  const insight = generateInsights(data, period).find((i) => i.id === id);

  if (!insight) {
    return (
      <Page>
        <Empty ill="dodo">Cette découverte n’est plus d’actualité.</Empty>
        <div className="pad" style={{ marginTop: 12 }}>
          <Link href="/decouvertes" className="btn line full">
            Découvertes
          </Link>
        </div>
      </Page>
    );
  }

  const v = insight.keyMetricValue;

  return (
    <Page>
      <h1 className="ar-sr">{insight.title}</h1>
      <div className="over">
        <span>Découverte de la semaine</span>
        <Link href="/decouvertes">Découvertes</Link>
      </div>
      <Hello title={insight.title} delay={0.1} />

      <div className="card rise" style={{ animationDelay: ".2s", margin: "16px 14px 0" }}>
        <p className="big">
          <CountUp value={v} fmt={(n) => (n < 0 ? sg(n) : eur(n))} />
        </p>
        <p className="note">{insight.keyMetricLabel}</p>
      </div>

      <p className="pad note rise" style={{ animationDelay: ".3s", marginTop: 16, fontSize: 15 }}>
        {insight.body}
      </p>

      {insight.cta && (
        <div className="pad rise" style={{ animationDelay: ".4s", marginTop: 16 }}>
          <Link href={insight.cta.action} className="btn full">
            {insight.cta.label}
          </Link>
        </div>
      )}

      <div className="pad rise" style={{ animationDelay: ".5s", marginTop: 18 }}>
        <Tip ill="carnet-buste">Découverte repérée automatiquement dans tes chiffres.</Tip>
      </div>
      <div className="end" />
    </Page>
  );
}
