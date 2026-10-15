"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { cap } from "@/components/bs/ui";
import { Chips, CountUp, Empty, Face, Ic, Money, Page as Ecran, Pill, Sec, Seg, coatFilter, eur, ini, sg } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { reconciledNets, monthBreakdown, horseTicket } from "@/lib/domain/ticket";
import { useDesk } from "@/components/bs/desk";
import { useRouter, useSearchParams } from "next/navigation";
import { BUCKET_LABEL, clientRevenues, type ClientBucket } from "@/lib/domain/clients";
import { currentPeriod } from "@/lib/utils/period";
import { CARE_META, upcomingDeadlines, type Deadline } from "@/lib/domain/care";
import { localToday } from "@/lib/utils/local-date";
import type { Horse } from "@/lib/domain/types";

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

type Vue = "chevaux" | "clients";

function Vues() {
  const router = useRouter();
  const [vue, setVue] = useState<Vue>(useSearchParams().get("vue") === "clients" ? "clients" : "chevaux");
  const choisir = (v: Vue) => {
    setVue(v);
    router.replace(v === "clients" ? "/chevaux?vue=clients" : "/chevaux", { scroll: false });
  };
  const bascule = (
    <Seg<Vue>
      value={vue}
      onChange={choisir}
      label="Voir par"
      options={[
        ["chevaux", "Chevaux"],
        ["clients", "Clients"],
      ]}
    />
  );
  return vue === "clients" ? <Clients bascule={bascule} /> : <Chevaux bascule={bascule} />;
}

const BUCKETS: ClientBucket[] = ["pension", "seances", "soins", "autres"];
const moisDe = () => cap(new Date().toLocaleDateString("fr-FR", { month: "long" }));
const formule = (h: Horse) => (h.pensionType ?? "pension").toLowerCase();
const quand = (d: Deadline) => (d.daysLeft < 0 ? `en retard de ${-d.daysLeft} j` : d.daysLeft === 0 ? "aujourd’hui" : `dans ${d.daysLeft} j`);

function NetPill({ v }: { v: number }) {
  const r = Math.round(v);
  return <Pill tone={r > 0 ? "in" : r < 0 ? "out" : undefined}>{sg(v)}</Pill>;
}

/** Trois têtes qui respirent, en haut de l'écran. */
function Herd() {
  const horses = useDataStore((s) => s.horses);
  const three = horses.filter((h) => !h.isArchived).slice(0, 3);
  if (!three.length) return null;
  return (
    <div className="ch-herd rise" style={{ animationDelay: ".04s" }} aria-hidden="true">
      {three.map((h) => (
        <Face key={h.id} horse={h} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Clients : qui te paie le plus ce mois                               */
/* ------------------------------------------------------------------ */
function Clients({ bascule }: { bascule: React.ReactNode }) {
  const data = useDataStore();
  const desk = useDesk();
  const router = useRouter();
  const period = useMemo(() => currentPeriod(), []);
  const rows = useMemo(() => clientRevenues(data, period), [data, period]);
  const total = rows.reduce((t, c) => t + c.total, 0);
  const top = rows[0]?.total || 1;
  const month = moisDe();
  const sub = (c: (typeof rows)[number]) =>
    c.role === "proprietaire" ? (c.horses.length ? `propriétaire de ${c.horses.join(", ")}` : "propriétaire") : "cavalier";
  const parts = (c: (typeof rows)[number]) =>
    BUCKETS.filter((b) => c.buckets[b] > 0)
      .map((b) => `${BUCKET_LABEL[b]} ${eur(c.buckets[b])}`)
      .join(" · ");
  const href = (name: string) => `/clients?q=${encodeURIComponent(name)}`;
  const vide = <p className="note">Rien d’encaissé ce mois pour l’instant. Dès qu’une pension tombe ou qu’une séance est confirmée, le client apparaît ici.</p>;
  const fn = "Ici, seulement ce que chaque client te paie. Ce que coûte son cheval n’est pas déduit : c’est sur le ticket du cheval, dans l’onglet Chevaux.";

  if (desk) {
    return (
      <Ecran wide className="ch-desk">
        <div className="dhead rise">
          <div>
            <p className="k">{month}</p>
            <h3>Tes clients t’ont payé {eur(total)} ce mois.</h3>
            <p>Ceux qui te font le plus de chiffre d’affaires sont en haut.</p>
          </div>
        </div>
        <div className="ch-bar2 rise" style={{ animationDelay: ".08s" }}>
          {bascule}
        </div>
        {rows.length === 0 ? (
          <div style={{ marginTop: 14 }}>{vide}</div>
        ) : (
          <table className="tbl rise" style={{ animationDelay: ".14s" }}>
            <thead>
              <tr>
                <th>Client</th>
                <th>Chevaux</th>
                {BUCKETS.map((b) => (
                  <th key={b} className="n">
                    {b === "seances" ? "Séances" : b === "soins" ? "Soins" : BUCKET_LABEL[b]}
                  </th>
                ))}
                <th className="n">Total du mois</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.name} className="go" onClick={() => router.push(href(c.name))}>
                  <td>
                    <Link href={href(c.name)} className="who" onClick={(e) => e.stopPropagation()}>
                      <span className="ini">{ini(c.name)}</span>
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
                  {BUCKETS.map((b) => {
                    const s = rows.reduce((t, c) => t + c.buckets[b], 0);
                    return (
                      <td key={b} className="n">
                        {s ? eur(s) : "·"}
                      </td>
                    );
                  })}
                  <td className="n">{eur(total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
        <p className="ch-fn">{fn}</p>
      </Ecran>
    );
  }

  return (
    <Ecran>
      <Herd />
      <div className="hello rise" style={{ animationDelay: ".12s" }}>
        <p className="ch-over0">{month}</p>
        <h3>
          Tes clients t’ont payé{" "}
          <span className="in">
            <CountUp value={total} />
          </span>{" "}
          ce mois.
        </h3>
        <p>Ceux qui te font le plus de chiffre d’affaires sont en haut.</p>
      </div>
      <div className="ch-bar rise" style={{ animationDelay: ".2s" }}>
        {bascule}
      </div>
      <Sec nomarge title="Du plus gros au plus petit" delay={0.26}>
        {rows.length === 0 && vide}
        <div className="rows">
          {rows.map((c) => (
            <Link key={c.name} href={href(c.name)} className="li ch-cli">
              <span className="ini">{ini(c.name)}</span>
              <span style={{ minWidth: 0 }}>
                <b>{c.name}</b>
                <small>{sub(c)}</small>
                <small className="pt">{parts(c)}</small>
                <span className="bar" aria-hidden="true">
                  <i style={{ width: `${Math.max(2, (c.total / top) * 100)}%` }} />
                </span>
              </span>
              <Pill tone="in">{sg(c.total)}</Pill>
            </Link>
          ))}
        </div>
        <p className="note" style={{ fontSize: 12.5 }}>
          {fn}
        </p>
      </Sec>
      <div className="end" />
    </Ecran>
  );
}

/* ------------------------------------------------------------------ */
/* Chevaux : ce que chacun te laisse                                   */
/* ------------------------------------------------------------------ */
type Filtre = "tous" | "pos" | "neg" | "prevoir";

function Chevaux({ bascule }: { bascule: React.ReactNode }) {
  const data = useDataStore();
  const period = useMemo(() => currentPeriod(), []);
  const nets = useMemo(() => reconciledNets(data, period), [data, period]);
  const m = useMemo(() => monthBreakdown(data, period), [data, period]);
  const horses = data.horses.filter((h) => !h.isArchived);
  const sorted = [...horses].sort((a, b) => (nets[b.id] ?? 0) - (nets[a.id] ?? 0));
  const pos = sorted.filter((h) => (nets[h.id] ?? 0) > 0);
  const neg = sorted.filter((h) => (nets[h.id] ?? 0) <= 0).reverse();
  const [f, setF] = useState<Filtre>("tous");
  const dues = useMemo(() => upcomingDeadlines(data, localToday()).filter((d) => d.status !== "ok"), [data]);
  const dueHorses = sorted.filter((h) => dues.some((d) => d.horseId === h.id));
  const month = moisDe();
  const desk = useDesk();
  const router = useRouter();
  const ajouter = "/saisie/cheval";

  const chips = (
    <Chips<Filtre>
      value={f}
      onChange={setF}
      options={[
        ["tous", `Tous · ${horses.length}`],
        ["pos", `Te rapportent · ${pos.length}`],
        ["neg", `Te coûtent · ${neg.length}`],
        ["prevoir", `Soins à prévoir · ${new Set(dues.map((d) => d.horseId)).size}`],
      ]}
    />
  );

  const row = (h: Horse) => (
    <Link key={h.id} href={`/ticket?id=${h.id}`} className="li">
      <Face horse={h} />
      <span style={{ minWidth: 0 }}>
        <b>{h.name}</b>
        <small>{[formule(h), h.ownerName].filter(Boolean).join(" · ")}</small>
      </span>
      <NetPill v={nets[h.id] ?? 0} />
    </Link>
  );

  if (desk) {
    const shown = f === "pos" ? pos : f === "neg" ? neg : f === "prevoir" ? dueHorses : sorted;
    const rows = shown.map((h) => ({ h, t: horseTicket(data, h.id, period), net: nets[h.id] ?? 0, due: dues.filter((d) => d.horseId === h.id) }));
    const tot = rows.reduce((a, r) => ({ rev: a.rev + r.t.revenue, dir: a.dir + r.t.direct, share: a.share + r.t.share, net: a.net + r.net }), { rev: 0, dir: 0, share: 0, net: 0 });
    const nPos = rows.filter((r) => r.net > 0).length;
    const each = horses.length ? m.sharedTotal / horses.length : 0;
    return (
      <Ecran wide className="ch-desk">
        <div className="dhead rise">
          <div>
            <p className="k">{month}</p>
            <h3>Mes chevaux</h3>
            <p>
              Ce mois, ils {m.net >= 0 ? "te laissent" : "te coûtent"} <Money v={m.net} /> à eux tous, une fois leurs frais payés. Clique un cheval pour voir le détail.
            </p>
          </div>
          <Link href={ajouter} className="btn">
            <Ic n="plus" className="" />
            Ajouter un cheval
          </Link>
        </div>
        <div className="ch-bar2 rise" style={{ animationDelay: ".08s" }}>
          {bascule}
          {chips}
        </div>
        <table className="tbl rise" style={{ animationDelay: ".14s" }}>
          <thead>
            <tr>
              <th>Cheval</th>
              <th>Formule</th>
              <th>Propriétaire</th>
              <th className="n">Ce qu’on te paie</th>
              <th className="n">Soins et frais</th>
              <th className="n">Part du pot commun</th>
              <th className="n">Ce qu’il te laisse</th>
              <th>À prévoir</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ h, t, net, due }) => (
              <tr key={h.id} className="go" onClick={() => router.push(`/ticket?id=${h.id}`)}>
                <td>
                  <Link href={`/ticket?id=${h.id}`} className="who" onClick={(e) => e.stopPropagation()}>
                    <Face horse={h} />
                    {h.name}
                  </Link>
                </td>
                <td className="m">{formule(h)}</td>
                <td className="m">{h.ownerName ?? ""}</td>
                <td className="n">{eur(t.revenue)}</td>
                <td className="n m">{t.direct ? `−${eur(t.direct)}` : "0 €"}</td>
                <td className="n m">−{eur(t.share)}</td>
                <td className="n">
                  <NetPill v={net} />
                </td>
                <td className="due">
                  {due.map((d, i) => {
                    const late = d.status === "overdue";
                    const txt = `${CARE_META[d.kind].label.toLowerCase()}${late ? ", " : " "}${quand(d)}`;
                    return (
                      <span key={d.kind}>
                        {i > 0 && ", "}
                        {late ? <b>{txt}</b> : txt}
                      </span>
                    );
                  })}
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr>
                <td colSpan={3}>
                  {rows.length} chevaux · {nPos} te rapportent, {rows.length - nPos} te coûtent
                </td>
                <td className="n">{eur(tot.rev)}</td>
                <td className="n">−{eur(tot.dir)}</td>
                <td className="n">−{eur(tot.share)}</td>
                <td className="n">
                  <Money v={tot.net} />
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
        {rows.length === 0 && <p className="note">{horses.length ? "Aucun cheval dans ce filtre." : "Aucun cheval pour l’instant. Ajoute le premier avec le bouton en haut."}</p>}
        <p className="ch-fn">
          « Ce qu’il te laisse » : ce qu’on te paie pour lui, moins ses soins et ses frais, moins sa part du pot commun (foin, salaires, loyer…){horses.length ? `, ${eur(each)} par cheval ce mois` : ""}.
        </p>
      </Ecran>
    );
  }

  const n = horses.length;
  const firstNeg = neg[0];
  const reste = n - dueHorses.length;
  return (
    <Ecran>
      <Herd />
      <div className="hello rise" style={{ animationDelay: ".12s" }}>
        <p className="ch-over0">{month}</p>
        <h3>
          {n === 1 ? "Ton cheval" : `Tes ${n} chevaux`} {m.net >= 0 ? (n === 1 ? "te laisse" : "te laissent") : n === 1 ? "te coûte" : "te coûtent"}{" "}
          <span className={m.net >= 0 ? "in" : "out"}>
            <CountUp value={m.net} />
          </span>{" "}
          ce mois.
        </h3>
        <p>Une fois leurs soins et leur part des frais communs payés. Touche un cheval pour voir son ticket.</p>
      </div>
      <div className="ch-bar rise" style={{ animationDelay: ".2s" }}>
        {bascule}
      </div>
      {n > 0 && (
        <div className="pad rise" style={{ animationDelay: ".26s", paddingTop: 12 }}>
          {chips}
        </div>
      )}
      {n === 0 && <Empty>Aucun cheval pour l’instant. Ajoute le premier ci-dessous.</Empty>}

      {f === "prevoir" && (
        <Sec blk ill="confirmer" title="Soins à prévoir" delay={0.1}>
          {dues.length === 0 && <p className="note">Aucun soin à prévoir. Tout est à jour.</p>}
          <div className="rows">
            {dueHorses.map((h) => {
              const ds = dues.filter((d) => d.horseId === h.id);
              return (
                <Link key={h.id} href={`/ticket?id=${h.id}`} className="li">
                  <Face horse={h} />
                  <span style={{ minWidth: 0 }}>
                    <b>{h.name}</b>
                    <small className={ds.some((d) => d.status === "overdue") ? "ch-late" : undefined}>
                      {ds.map((d) => `${CARE_META[d.kind].label.toLowerCase()} ${quand(d)}`).join(" · ")}
                    </small>
                  </span>
                  <Ic n="chev" className="chev" />
                </Link>
              );
            })}
          </div>
          {dues.length > 0 && reste > 0 && <p className="note">{reste === 1 ? "L’autre est à jour." : `Les ${reste} autres sont à jour.`}</p>}
        </Sec>
      )}
      {(f === "tous" || f === "pos") && pos.length > 0 && (
        <Sec ill="sacoche" title="Ils te rapportent" delay={0.34}>
          <div className="rows">{pos.map(row)}</div>
        </Sec>
      )}
      {(f === "tous" || f === "neg") && neg.length > 0 && (
        <Sec ill="tete-fondu" illStyle={{ filter: coatFilter(firstNeg) }} title="Ils te coûtent" delay={0.42}>
          <div className="rows">{neg.map(row)}</div>
        </Sec>
      )}
      <div className="ch-after">
        <Link href={ajouter} className="btn line full">
          <Ic n="plus" className="" />
          Ajouter un cheval
        </Link>
      </div>
      <div className="end" />
    </Ecran>
  );
}
