"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { NetPill, Over, Screen, Sec, cap, signed } from "@/components/bs/ui";
import { Picto } from "@/components/bs/picto";
import { HorseFace } from "@/components/bs/horse-face";
import { useDataStore } from "@/stores/data-store";
import { reconciledNets, monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";
import { CARE_META, upcomingDeadlines } from "@/lib/domain/care";
import { localToday } from "@/lib/utils/local-date";

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
  const [f, setF] = useState<"tous" | "pos" | "neg" | "prevoir">("tous");
  const dues = useMemo(() => upcomingDeadlines(data, localToday()).filter((d) => d.status !== "ok"), [data]);
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
      <div className="bs-chips" style={{ marginTop: 12 }}>
        {(
          [
            ["tous", `Tous · ${horses.length}`],
            ["pos", `Rapportent · ${pos.length}`],
            ["neg", `Coûtent · ${neg.length}`],
            ["prevoir", `À prévoir · ${new Set(dues.map((d) => d.horseId)).size}`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" className="bs-chip" aria-pressed={f === k} onClick={() => setF(k)}>
            {l}
          </button>
        ))}
      </div>
      {f === "prevoir" && (
        <>
          <Sec>Soins à prévoir</Sec>
          {dues.length === 0 && <p className="bs-p">Rien à prévoir. Tout est à jour.</p>}
          {sorted
            .filter((h) => dues.some((d) => d.horseId === h.id))
            .map((h) => (
              <Link key={h.id} href={`/ticket?id=${h.id}`} className="bs-li tap">
                <HorseFace horse={h} size={44} />
                <span className="tx">
                  <b>{h.name}</b>
                  <span className={dues.some((d) => d.horseId === h.id && d.status === "overdue") ? "bs-late" : ""}>
                    {dues
                      .filter((d) => d.horseId === h.id)
                      .map((d) => `${CARE_META[d.kind].label.toLowerCase()} ${d.daysLeft < 0 ? `en retard de ${-d.daysLeft} j` : d.daysLeft === 0 ? "aujourd’hui" : `dans ${d.daysLeft} j`}`)
                      .join(" · ")}
                  </span>
                </span>
                <Picto name="chev" />
              </Link>
            ))}
        </>
      )}
      {(f === "tous" || f === "pos") && pos.length > 0 && (
        <>
          <Sec>Ils te rapportent</Sec>
          {pos.map(row)}
        </>
      )}
      {(f === "tous" || f === "neg") && neg.length > 0 && (
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
