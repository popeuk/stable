"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { NetPill, Over, Screen, Sec, cap, signed } from "@/components/bs/ui";
import { Picto } from "@/components/bs/picto";
import { HorseFace } from "@/components/bs/horse-face";
import { useDataStore } from "@/stores/data-store";
import { reconciledNets, monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";

/** Mes chevaux : une tête, un nom, un total. Ceux qui rapportent d'abord. */
export default function Page() {
  return (
    <ClientGate>
      <Chevaux />
    </ClientGate>
  );
}

function Chevaux() {
  const data = useDataStore();
  const period = useMemo(() => currentPeriod(), []);
  const nets = useMemo(() => reconciledNets(data, period), [data, period]);
  const m = useMemo(() => monthBreakdown(data, period), [data, period]);
  const horses = data.horses.filter((h) => !h.isArchived);
  const sorted = [...horses].sort((a, b) => (nets[b.id] ?? 0) - (nets[a.id] ?? 0));
  const pos = sorted.filter((h) => (nets[h.id] ?? 0) > 0);
  const neg = sorted.filter((h) => (nets[h.id] ?? 0) <= 0).reverse();
  const month = cap(new Date().toLocaleDateString("fr-FR", { month: "long" }));

  const row = (h: (typeof horses)[number]) => (
    <Link key={h.id} href={`/ticket?id=${h.id}`} className="bs-li tap">
      <HorseFace horse={h} size={44} />
      <span className="tx">
        <b>{h.name}</b>
        <span>{(h.pensionType ?? "pension").toLowerCase()}</span>
      </span>
      <NetPill value={nets[h.id] ?? 0} />
    </Link>
  );

  return (
    <Screen>
      <Over left={month} />
      <h1 className="bs-d bs-t1">Mes chevaux</h1>
      <p className="bs-p">
        Ce mois, ils te laissent{" "}
        <b style={{ color: m.net >= 0 ? "var(--vert)" : "var(--rose-ink)", fontWeight: 600 }}>{signed(m.net)}</b> à eux tous. Touche un cheval pour voir son ticket.
      </p>
      {pos.length > 0 && (
        <>
          <Sec>Ils te rapportent</Sec>
          {pos.map(row)}
        </>
      )}
      {neg.length > 0 && (
        <>
          <Sec>Ils te coûtent</Sec>
          {neg.map(row)}
        </>
      )}
      <Link href="/parcours/chevaux?retour=chevaux" className="bs-btn line" style={{ marginTop: 18 }}>
        <Picto name="plus" />
        Ajouter un cheval
      </Link>
    </Screen>
  );
}
