"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { NetPill, Over, Screen, Sec, cap, signed } from "@/components/bs/ui";
import { Picto } from "@/components/bs/picto";
import { HorseFace } from "@/components/bs/horse-face";
import { useDataStore } from "@/stores/data-store";
import { reconciledNets, monthBreakdown, horseTicket } from "@/lib/domain/ticket";
import { useDesk } from "@/components/bs/desk";
import { useRouter, useSearchParams } from "next/navigation";
import { BUCKET_LABEL, clientRevenues, type ClientBucket } from "@/lib/domain/clients";
import { eur } from "@/components/bs/ui";
import { currentPeriod } from "@/lib/utils/period";
import { CARE_META, upcomingDeadlines } from "@/lib/domain/care";
import { localToday } from "@/lib/utils/local-date";

/**
 * Mes chevaux : une tête, un nom, un total. Ceux qui rapportent d'abord.
 * La bascule « Clients » montre l'autre côté : qui te paie le plus ce mois,
 * sans rien déduire (les frais restent sur le ticket du cheval).
 */
export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <Vues />
      </Suspense>
    </ClientGate>
  );
}

function Vues() {
  const router = useRouter();
  const [vue, setVue] = useState<"chevaux" | "clients">(useSearchParams().get("vue") === "clients" ? "clients" : "chevaux");
  const choisir = (v: "chevaux" | "clients") => {
    setVue(v);
    router.replace(v === "clients" ? "/chevaux?vue=clients" : "/chevaux", { scroll: false });
  };
  const bascule = (
    <div className="bs-seg bs-vue" role="tablist" aria-label="Voir par">
      <button type="button" role="tab" aria-selected={vue === "chevaux"} aria-pressed={vue === "chevaux"} onClick={() => choisir("chevaux")}>
        Chevaux
      </button>
      <button type="button" role="tab" aria-selected={vue === "clients"} aria-pressed={vue === "clients"} onClick={() => choisir("clients")}>
        Clients
      </button>
    </div>
  );
  return vue === "clients" ? <Clients bascule={bascule} /> : <Chevaux bascule={bascule} />;
}

const ini = (n: string) =>
  n
    .split(/\s+/)
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const BUCKETS: ClientBucket[] = ["pension", "seances", "soins", "autres"];

function Clients({ bascule }: { bascule: React.ReactNode }) {
  const data = useDataStore();
  const desk = useDesk();
  const router = useRouter();
  const period = useMemo(() => currentPeriod(), []);
  const rows = useMemo(() => clientRevenues(data, period), [data, period]);
  const total = rows.reduce((t, c) => t + c.total, 0);
  const top = rows[0]?.total || 1;
  const month = cap(new Date().toLocaleDateString("fr-FR", { month: "long" }));
  const sub = (c: (typeof rows)[number]) =>
    c.role === "proprietaire" ? (c.horses.length ? `propriétaire de ${c.horses.join(", ")}` : "propriétaire") : "cavalier";
  const parts = (c: (typeof rows)[number]) =>
    BUCKETS.filter((b) => c.buckets[b] > 0)
      .map((b) => `${BUCKET_LABEL[b]} ${eur(c.buckets[b])}`)
      .join(" · ");
  const go = (name: string) => router.push(`/clients?q=${encodeURIComponent(name)}`);

  return (
    <Screen wide={desk}>
      <div className={desk ? "bs-dhead" : undefined}>
        <div>
          <Over left={month} />
          <h1 className="bs-d bs-t1">Mes clients</h1>
          <p className="bs-p">
            Ce mois, tes clients t’ont payé <b style={{ color: "var(--vert)", fontWeight: 600 }}>{eur(total)}</b> à eux tous. Ceux qui te font le plus de chiffre d’affaires sont en haut.
          </p>
        </div>
      </div>
      {bascule}
      {rows.length === 0 && (
        <p className="bs-p" style={{ marginTop: 16 }}>
          Rien d’encaissé ce mois pour l’instant. Dès qu’une pension tombe ou qu’une séance est confirmée, le client apparaît ici.
        </p>
      )}
      {desk && rows.length > 0 && (
        <table className="bs-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Chevaux</th>
              {BUCKETS.map((b) => (
                <th key={b} className="n">
                  {BUCKET_LABEL[b]}
                </th>
              ))}
              <th className="n">Total du mois</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.name} className="go" onClick={() => go(c.name)}>
                <td>
                  <Link href={`/clients?q=${encodeURIComponent(c.name)}`} className="who" onClick={(e) => e.stopPropagation()}>
                    <span className="bs-ini">{ini(c.name)}</span>
                    {c.name}
                  </Link>
                </td>
                <td className="m">{c.role === "proprietaire" ? c.horses.join(", ") : "cavalier"}</td>
                {BUCKETS.map((b) => (
                  <td key={b} className={`n${c.buckets[b] ? "" : " m"}`}>
                    {c.buckets[b] ? eur(c.buckets[b]) : "·"}
                  </td>
                ))}
                <td className="n">
                  <b>{eur(c.total)}</b>
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr>
                <td colSpan={2}>{rows.length} clients</td>
                {BUCKETS.map((b) => (
                  <td key={b} className="n">
                    {eur(rows.reduce((t, c) => t + c.buckets[b], 0))}
                  </td>
                ))}
                <td className="n">{eur(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
      {!desk && rows.length > 0 && (
        <>
          <Sec>Du plus gros au plus petit</Sec>
          {rows.map((c) => (
            <Link key={c.name} href={`/clients?q=${encodeURIComponent(c.name)}`} className="bs-li tap bs-cli">
              <span className="bs-ini">{ini(c.name)}</span>
              <span className="tx">
                <b>{c.name}</b>
                <span>{sub(c)}</span>
                <span className="pt">{parts(c)}</span>
                <i className="bar" aria-hidden="true">
                  <i style={{ transform: `scaleX(${c.total / top})` }} />
                </i>
              </span>
              <span className="bs-pill g">{eur(c.total)}</span>
            </Link>
          ))}
        </>
      )}
      <p className="bs-p" style={{ fontSize: 12.5, marginTop: 14 }}>
        Ici, seulement ce que chaque client te paie. Ce que coûte son cheval n’est pas déduit : c’est sur le ticket du cheval, dans l’onglet Chevaux.
      </p>
    </Screen>
  );
}

function Chevaux({ bascule }: { bascule: React.ReactNode }) {
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
              Ce mois, ils te laissent <b style={{ color: m.net >= 0 ? "var(--vert)" : "var(--rose-ink)", fontWeight: 600 }}>{signed(m.net)}</b> à eux tous, une fois leurs frais payés. Clique un cheval pour voir le détail.
            </p>
          </div>
          <Link href="/parcours/chevaux?retour=chevaux" className="bs-btn" style={{ width: "auto" }}>
            <Picto name="plus" />
            Ajouter un cheval
          </Link>
        </div>
        {bascule}
        <div className="bs-chips" style={{ marginTop: 16 }}>
          {(
            [
              ["tous", `Tous · ${horses.length}`],
              ["pos", `Te rapportent · ${pos.length}`],
              ["neg", `Te coûtent · ${neg.length}`],
              ["prevoir", `Soins à prévoir · ${new Set(dues.map((d) => d.horseId)).size}`],
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
              <th className="n">Ce qu’on te paie</th>
              <th className="n">Soins et frais</th>
              <th className="n">Part des frais communs</th>
              <th className="n">Ce qu’il te laisse</th>
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
          « Ce qu’il te laisse » : ce qu’on te paie pour lui, moins ses soins et ses frais, moins sa part des frais communs (foin, salaires, loyer…).
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
        <b style={{ color: m.net >= 0 ? "var(--vert)" : "var(--rose-ink)", fontWeight: 600 }}>{signed(m.net)}</b> à eux tous, une fois leurs frais payés. Touche un cheval pour voir le détail.
      </p>
      {bascule}
      <div className="bs-chips" style={{ marginTop: 12 }}>
        {(
          [
            ["tous", `Tous · ${horses.length}`],
            ["pos", `Te rapportent · ${pos.length}`],
            ["neg", `Te coûtent · ${neg.length}`],
            ["prevoir", `Soins à prévoir · ${new Set(dues.map((d) => d.horseId)).size}`],
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
          {dues.length === 0 && <p className="bs-p">Aucun soin à prévoir. Tout est à jour.</p>}
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
