"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { NetPill, Over, Screen, Sec, cap, signed } from "@/components/bs/ui";
import { Picto } from "@/components/bs/picto";
import { HorseFace } from "@/components/bs/horse-face";
import { useDataStore } from "@/stores/data-store";
import { reconciledNets, monthBreakdown, horseTicket } from "@/lib/domain/ticket";
import { useDesk } from "@/components/bs/desk";
import { useRouter } from "next/navigation";
import { eur } from "@/components/bs/ui";
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

  const desk = useDesk();
  const router = useRouter();

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

  if (desk) {
    const shown = f === "pos" ? pos : f === "neg" ? neg : f === "prevoir" ? sorted.filter((h) => dues.some((d) => d.horseId === h.id)) : sorted;
    const rows = shown.map((h) => ({ h, t: horseTicket(data, h.id, period), net: nets[h.id] ?? 0, due: dues.filter((d) => d.horseId === h.id) }));
    const tot = rows.reduce((a, r) => ({ rev: a.rev + r.t.revenue, dir: a.dir + r.t.direct, share: a.share + r.t.share, net: a.net + r.net }), { rev: 0, dir: 0, share: 0, net: 0 });
    return (
      <Screen wide>
        <div className="bs-dhead">
          <div>
            <Over left={month} />
            <h1 className="bs-d bs-t1">Mes chevaux</h1>
            <p className="bs-p">
              Ce mois, ils te laissent <b style={{ color: m.net >= 0 ? "var(--vert)" : "var(--rose-ink)", fontWeight: 600 }}>{signed(m.net)}</b> à eux tous. Clique un cheval pour ouvrir son ticket.
            </p>
          </div>
          <Link href="/parcours/chevaux?retour=chevaux" className="bs-btn" style={{ width: "auto" }}>
            <Picto name="plus" />
            Ajouter un cheval
          </Link>
        </div>
        <div className="bs-chips" style={{ marginTop: 16 }}>
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
        <table className="bs-table">
          <thead>
            <tr>
              <th>Cheval</th>
              <th>Formule</th>
              <th>Propriétaire</th>
              <th className="n">Recettes</th>
              <th className="n">Soins et frais</th>
              <th className="n">Part de l’écurie</th>
              <th className="n">Il te laisse</th>
              <th>À prévoir</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ h, t, net, due }) => (
              <tr key={h.id} className="go" onClick={() => router.push(`/ticket?id=${h.id}`)}>
                <td>
                  <Link href={`/ticket?id=${h.id}`} className="who" onClick={(e) => e.stopPropagation()}>
                    <HorseFace horse={h} size={34} />
                    {h.name}
                  </Link>
                </td>
                <td className="m" style={{ whiteSpace: "nowrap" }}>{(h.pensionType ?? "pension").toLowerCase()}</td>
                <td className="m">{h.ownerName ?? ""}</td>
                <td className="n">{eur(t.revenue)}</td>
                <td className="n m">{t.direct ? `−${eur(t.direct)}` : "0 €"}</td>
                <td className="n m">−{eur(t.share)}</td>
                <td className="n">
                  <NetPill value={net} />
                </td>
                <td className={due.some((d) => d.status === "overdue") ? "bs-late" : "m"} style={{ fontSize: 12.5 }}>
                  {due.map((d) => `${CARE_META[d.kind].label.toLowerCase()} ${d.daysLeft < 0 ? `(retard ${-d.daysLeft} j)` : d.daysLeft === 0 ? "aujourd’hui" : `dans ${d.daysLeft} j`}`).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr>
                <td colSpan={3}>{rows.length} chevaux</td>
                <td className="n">{eur(tot.rev)}</td>
                <td className="n">−{eur(tot.dir)}</td>
                <td className="n">−{eur(tot.share)}</td>
                <td className="n">{signed(tot.net)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
        {rows.length === 0 && <p className="bs-p" style={{ marginTop: 14 }}>Aucun cheval dans ce filtre.</p>}
        <p className="bs-p" style={{ fontSize: 12.5, marginTop: 12 }}>
          « Il te laisse » = recettes moins soins et frais, moins sa part des factures communes (foin, salaires, loyer…).
        </p>
      </Screen>
    );
  }

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
