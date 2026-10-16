"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { cap } from "@/components/bs/ui";
import { Chips, CountUp, Empty, Face, Ic, Money, Page as Ecran, Pill, Sec, Seg, coatFilter, eur, ini, sg } from "@/components/carnet/ui";
import { AEncaisser, ListePaniers, usePaniers } from "@/components/bs/paniers";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { reconciledNets, monthBreakdown, horseTicket } from "@/lib/domain/ticket";
import { suggestions } from "@/lib/domain/leviers";
import { useDesk } from "@/components/bs/desk";
import { useRouter, useSearchParams } from "next/navigation";
import { BUCKET_LABEL, clientRevenues, type ClientBucket, type ClientRevenue } from "@/lib/domain/clients";
import { currentPeriod } from "@/lib/utils/period";
import { CARE_META, upcomingDeadlines, type Deadline } from "@/lib/domain/care";
import { localToday } from "@/lib/utils/local-date";
import type { Horse } from "@/lib/domain/types";

/**
 * Clients et chevaux : un onglet, deux vues.
 * Clients : les paniers à valider, ce qui reste à encaisser, puis tout le monde.
 * Chevaux : le cheval à surveiller en tête, puis ce que chacun te laisse.
 * Vue par défaut : Clients quand des paniers attendent (l'onglet de la barre
 * porte leur badge), sinon Chevaux. `?vue=clients` ou `?vue=chevaux` force la vue.
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
  const brut = useSearchParams().get("vue");
  const { count } = usePaniers();
  const [vue, setVue] = useState<Vue>(brut === "clients" || brut === "chevaux" ? brut : count > 0 ? "clients" : "chevaux");
  const choisir = (v: Vue) => {
    setVue(v);
    router.replace(`/chevaux?vue=${v}`, { scroll: false });
  };
  const bascule = (
    <Seg<Vue>
      value={vue}
      onChange={choisir}
      label="Voir"
      options={[
        ["clients", count > 0 ? `Clients · ${count}` : "Clients"],
        ["chevaux", "Chevaux"],
      ]}
    />
  );
  return vue === "clients" ? <Clients bascule={bascule} /> : <Chevaux bascule={bascule} />;
}

const BUCKETS: ClientBucket[] = ["pension", "seances", "soins", "autres"];
const moisDe = () => cap(new Date().toLocaleDateString("fr-FR", { month: "long" }));
const formule = (h: Horse) => (h.pensionType ?? "pension").toLowerCase();
const quand = (d: Deadline) => (d.daysLeft < 0 ? `en retard de ${-d.daysLeft} j` : d.daysLeft === 0 ? "aujourd’hui" : `dans ${d.daysLeft} j`);
/** Les chevaux créés par l'essai sans compte s'appellent « Cheval 1 », « Cheval 2 »… */
const sansNom = (h: Horse) => /^Cheval \d+$/.test(h.name.trim());

function NetPill({ v }: { v: number }) {
  const r = Math.round(v);
  return <Pill tone={r > 0 ? "in" : r < 0 ? "out" : undefined}>{sg(v)}</Pill>;
}

/** Le sélecteur Clients · Chevaux, collé en haut de l'écran sur téléphone. */
function Haut({ bascule }: { bascule: React.ReactNode }) {
  return (
    <>
      <h1 className="ch-sr">Clients et chevaux</h1>
      <div className="ch-cchd">{bascule}</div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Clients : à valider, à encaisser, puis tout le monde                */
/* ------------------------------------------------------------------ */
type Ligne = ClientRevenue & { phone?: string };

function Clients({ bascule }: { bascule: React.ReactNode }) {
  const data = useDataStore();
  const desk = useDesk();
  const router = useRouter();
  const { count, total: aValider } = usePaniers();
  const [q, setQ] = useState("");
  const period = useMemo(() => currentPeriod(), []);
  const rows = useMemo<Ligne[]>(() => {
    const people = (data.people ?? []).filter((p) => p.active);
    const phone = (name: string) => people.find((p) => p.name === name)?.phone;
    const rev = clientRevenues(data, period);
    const seen = new Set(rev.map((r) => r.name));
    const zero = { pension: 0, seances: 0, soins: 0, autres: 0 };
    const autres = people
      .filter((p) => !seen.has(p.name))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"))
      .map((p) => ({ name: p.name, role: p.role, horses: data.horses.filter((h) => !h.isArchived && h.ownerName === p.name).map((h) => h.name), buckets: zero, total: 0 }));
    return [...rev, ...autres].map((r) => ({ ...r, phone: phone(r.name) }));
  }, [data, period]);
  const shown = q ? rows.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : rows;
  const total = rows.reduce((t, c) => t + c.total, 0);
  const month = moisDe();
  const horseOf = (c: Ligne) => data.horses.find((h) => !h.isArchived && c.horses.includes(h.name));
  const sub = (c: Ligne) => (c.role === "proprietaire" ? c.horses.join(", ") || "propriétaire" : "cavalier");
  const href = (name: string) => `/clients?q=${encodeURIComponent(name)}`;
  const valNote = count > 0 && (
    <p className="note ch-cnt">
      {count} client{count > 1 ? "s" : ""} · <span className="in">{sg(aValider)}</span> à valider
    </p>
  );
  const search = (
    <label className="input ch-search">
      <Ic n="search" className="" />
      <input placeholder="Chercher un client" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher un client" />
    </label>
  );
  const vide = <p className="note">{q ? "Personne à ce nom." : "Personne pour l’instant. Un nom noté dans une séance devient un client tout seul."}</p>;
  const pros = (
    <p className="ch-fn">
      Le maréchal, le vétérinaire et les autres pros sont dans{" "}
      <Link className="lnk" href="/contacts">
        tes contacts
      </Link>
      .
    </p>
  );
  const valider = (
    <Sec blk ill="confirmer" title="À valider" delay={0.08}>
      {valNote}
      <ListePaniers />
    </Sec>
  );
  const encaisser = (
    <Sec blk ill="sacoche" title="À encaisser" action={<Link href="/argent?vue=facturer">Le détail</Link>} delay={0.14}>
      <AEncaisser />
    </Sec>
  );

  if (desk) {
    return (
      <Ecran wide className="ch-desk">
        <div className="dhead rise">
          <div>
            <p className="k">{month}</p>
            <h3>Clients et chevaux</h3>
            <p>
              Tes clients t’ont payé <Money v={total} /> ce mois. Ceux qui te font le plus de chiffre d’affaires sont en haut.
            </p>
          </div>
          <Link href="/clients" className="btn line">
            <Ic n="plus" className="" />
            Ajouter un client
          </Link>
        </div>
        <div className="ch-bar2 rise" style={{ animationDelay: ".08s" }}>
          {bascule}
          {search}
        </div>
        <div className="cols2 ch-cols">
          <div>
            {shown.length === 0 ? (
              <div style={{ marginTop: 14 }}>{vide}</div>
            ) : (
              <table className="tbl rise" style={{ animationDelay: ".14s" }}>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Chevaux</th>
                    <th>Téléphone</th>
                    {BUCKETS.map((b) => (
                      <th key={b} className="n">
                        {b === "seances" ? "Séances" : b === "soins" ? "Soins" : BUCKET_LABEL[b]}
                      </th>
                    ))}
                    <th className="n">Total du mois</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => (
                    <tr key={c.name} className="go" onClick={() => router.push(href(c.name))}>
                      <td>
                        <Link href={href(c.name)} className="who" onClick={(e) => e.stopPropagation()}>
                          <span className="ini">{ini(c.name)}</span>
                          {c.name}
                        </Link>
                      </td>
                      <td className="m">{c.role === "proprietaire" ? c.horses.join(", ") : "cavalier"}</td>
                      <td className="m">{c.phone ?? ""}</td>
                      {BUCKETS.map((b) => (
                        <td key={b} className={`n${c.buckets[b] ? "" : " m"}`}>
                          {c.buckets[b] ? eur(c.buckets[b]) : "·"}
                        </td>
                      ))}
                      <td className="n">{c.total ? <b>{eur(c.total)}</b> : <span className="m">·</span>}</td>
                    </tr>
                  ))}
                </tbody>
                {shown.length > 1 && (
                  <tfoot>
                    <tr>
                      <td colSpan={3}>{shown.length} clients</td>
                      {BUCKETS.map((b) => {
                        const s = shown.reduce((t, c) => t + c.buckets[b], 0);
                        return (
                          <td key={b} className="n">
                            {s ? eur(s) : "·"}
                          </td>
                        );
                      })}
                      <td className="n">{eur(shown.reduce((t, c) => t + c.total, 0))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
            <p className="ch-fn">Ici, seulement ce que chaque client te paie. Ce que coûte son cheval n’est pas déduit : c’est sur le ticket du cheval, dans la vue Chevaux.</p>
            {pros}
          </div>
          <div className="ch-stick">
            {valider}
            {encaisser}
          </div>
        </div>
        <div className="end" />
      </Ecran>
    );
  }

  return (
    <Ecran>
      <Haut bascule={bascule} />
      {valider}
      {encaisser}
      <Sec ill="gerant-buste" title="Tous les clients" action={<Link href="/clients">+ Ajouter</Link>} delay={0.2}>
        <div className="ch-find">{search}</div>
        <p className="note">
          Ce qu’ils t’ont payé en {month.toLowerCase()} : <span className="in">{sg(total)}</span>.
        </p>
        {shown.length === 0 && vide}
        <div className="rows">
          {shown.map((c) => {
            const h = horseOf(c);
            return (
              <Link key={c.name} href={href(c.name)} className="li ch-cli">
                {h ? <Face horse={h} /> : <span className="ini">{ini(c.name)}</span>}
                <span style={{ minWidth: 0 }}>
                  <b>{c.name}</b>
                  <small>{sub(c)}</small>
                  {c.phone && <small className="pt">{c.phone}</small>}
                </span>
                {c.total ? <Pill tone="in">{sg(c.total)}</Pill> : <small>rien ce mois</small>}
              </Link>
            );
          })}
        </div>
        {pros}
      </Sec>
      <div className="end" />
    </Ecran>
  );
}

/* ------------------------------------------------------------------ */
/* Chevaux : celui à surveiller, puis ce que chacun te laisse          */
/* ------------------------------------------------------------------ */

/** Le cheval qui te coûte le plus ce mois, s'il te coûte, avec ce qui presse pour lui. */
function ASurveiller({ delay }: { delay: number }) {
  const data = useDataStore();
  const capacity = useSettingsStore((s) => s.capacity);
  const pick = useMemo(() => {
    const p = currentPeriod();
    const nets = reconciledNets(data, p);
    const horses = data.horses.filter((h) => !h.isArchived && nets[h.id] !== undefined && nets[h.id] < 0);
    if (!horses.length) return null;
    const h = horses.sort((a, b) => nets[a.id] - nets[b.id])[0];
    const s = suggestions(data, p, capacity).find((x) => x.apply?.type === "pension" && x.apply.horseId === h.id);
    const floor = s?.apply?.type === "pension" ? s.apply.amount : undefined;
    const late = upcomingDeadlines(data, localToday()).find((d) => d.horseId === h.id && d.status === "overdue");
    return { h, net: nets[h.id], floor, late };
  }, [data, capacity]);
  if (!pick) return null;
  const { h, net, floor, late } = pick;
  return (
    <Sec blk ill="tete-fondu" illStyle={{ filter: coatFilter(h) }} title="Un cheval à surveiller" delay={delay}>
      <Link href={`/ticket?id=${h.id}`} className="ch-watch">
        <Face horse={h} />
        <span style={{ minWidth: 0 }}>
          <b>{h.name} mange plus qu’il ne paie.</b>
          <small>
            {late && `${cap(CARE_META[late.kind].label.toLowerCase())} en retard de ${-late.daysLeft} jour${-late.daysLeft > 1 ? "s" : ""}. `}
            {floor && h.pension ? `À ${eur(floor)} au lieu de ${eur(h.pension)}, sa pension couvrirait ses frais.` : "Ce mois, il te coûte plus qu’il ne te rapporte."}
          </small>
        </span>
        <Money v={net} />
      </Link>
    </Sec>
  );
}

/** Les chevaux créés par l'essai sans compte attendent leur vrai nom. */
function ANommer({ horses, delay }: { horses: Horse[]; delay: number }) {
  if (!horses.length) return null;
  return (
    <Sec blk ill="carnet-buste" title="Donne un nom à tes chevaux" delay={delay}>
      <p className="note ch-cnt">Tu les as comptés en essayant l’app. Un nom, une robe : tu les reconnais tout de suite.</p>
      <div className="rows">
        {horses.map((h) => (
          <Link key={h.id} href={`/saisie/cheval?edit=${h.id}`} className="li">
            <Face horse={h} />
            <span style={{ minWidth: 0 }}>
              <b>{h.name}</b>
              <small>{h.ownerName ? `à ${h.ownerName} · à renommer` : "à renommer"}</small>
            </span>
            <Ic n="chev" className="chev" />
          </Link>
        ))}
      </div>
    </Sec>
  );
}

type Filtre = "tous" | "pos" | "neg" | "prevoir";

function Chevaux({ bascule }: { bascule: React.ReactNode }) {
  const data = useDataStore();
  const period = useMemo(() => currentPeriod(), []);
  const nets = useMemo(() => reconciledNets(data, period), [data, period]);
  const m = useMemo(() => monthBreakdown(data, period), [data, period]);
  const horses = data.horses.filter((h) => !h.isArchived);
  const anon = horses.filter(sansNom);
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
            <h3>Clients et chevaux</h3>
            <p>
              Ce mois, tes chevaux {m.net >= 0 ? "te laissent" : "te coûtent"} <Money v={m.net} /> à eux tous, une fois leurs frais payés. Clique un cheval pour voir le détail.
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
        <div className="ch-tops">
          <ASurveiller delay={0.1} />
          <ANommer horses={anon} delay={0.12} />
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
          «&nbsp;Ce qu’il te laisse&nbsp;» : ce qu’on te paie pour lui, moins ses soins et ses frais, moins sa part du pot commun (foin, salaires, loyer…){horses.length ? `, ${eur(each)} par cheval ce mois` : ""}.
        </p>
      </Ecran>
    );
  }

  const n = horses.length;
  const firstNeg = neg[0];
  const reste = n - dueHorses.length;
  return (
    <Ecran>
      <Haut bascule={bascule} />
      <ASurveiller delay={0.06} />
      <ANommer horses={anon} delay={0.1} />
      {n > 0 && (
        <div className="hello rise" style={{ animationDelay: ".14s" }}>
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
      )}
      {n > 0 && (
        <div className="pad rise" style={{ animationDelay: ".2s", paddingTop: 12 }}>
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
        <Sec ill="gerant-rosette" title="Ils te rapportent" delay={0.26}>
          <div className="rows">{pos.map(row)}</div>
        </Sec>
      )}
      {(f === "tous" || f === "neg") && neg.length > 0 && (
        <Sec ill="tete-fondu" illStyle={{ filter: coatFilter(firstNeg) }} title="Ils te coûtent" delay={0.32}>
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
