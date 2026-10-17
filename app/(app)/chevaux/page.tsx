"use client";

import Link from "next/link";
import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ClientGate } from "@/components/ui/client-gate";
import { cap } from "@/components/bs/ui";
import { Chips, CountUp, Empty, Face, Ic, Ill, Money, Page as Ecran, Pill, Sec, Seg, coatFilter, eur, ini, sg } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { reconciledNets, monthBreakdown, horseTicket } from "@/lib/domain/ticket";
import { suggestions } from "@/lib/domain/leviers";
import { useDesk } from "@/components/bs/desk";
import { useAideIci } from "@/components/bs/nav";
import { ChevauxDuClient } from "@/components/bs/choisir-proprio";
import { useRouter, useSearchParams } from "next/navigation";
import { accord, clientDues, prenomDe, type ClientDue } from "@/lib/domain/clients";
import { billsFor, monthKey } from "@/lib/domain/billing";
import { clientsAFairePayer } from "@/lib/domain/compte-auto";
import { addMonths, currentPeriod, daysInMonth } from "@/lib/utils/period";
import { CARE_META, upcomingDeadlines, type Deadline } from "@/lib/domain/care";
import { localToday } from "@/lib/utils/local-date";
import type { Horse, Period, PersonRole } from "@/lib/domain/types";
import { Partis } from "@/components/bs/partis";

/**
 * Clients : un onglet, deux vues.
 * Clients (en premier) : qui te doit quoi, trié par ce qu'ils doivent, et
 * le bandeau de fin de mois. Chevaux : le cheval à surveiller en tête,
 * puis ce que chacun te laisse. `?vue=chevaux` ouvre les chevaux.
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
  const [vue, setVue] = useState<Vue>(brut === "chevaux" ? "chevaux" : "clients");
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
        ["clients", "Clients"],
        ["chevaux", "Chevaux"],
      ]}
    />
  );
  // L'aide du « ? » suit l'onglet visible.
  const poser = useAideIci((s) => s.poser);
  useEffect(() => {
    poser(vue);
    return () => poser(null);
  }, [vue, poser]);
  return vue === "clients" ? <Clients bascule={bascule} /> : <Chevaux bascule={bascule} />;
}

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
      <h1 className="ch-sr">Clients</h1>
      <div className="ch-cchd">{bascule}</div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Tes clients : qui te doit quoi, du plus gros au plus petit           */
/* ------------------------------------------------------------------ */

/** « d’octobre », « de mai ». */
const deMoisDe = (p: Period) => {
  const m = new Date(p.year, p.month - 1, 15).toLocaleDateString("fr-FR", { month: "long" });
  return /^[aeiouyéè]/i.test(m) ? `d’${m}` : `de ${m}`;
};
const MOIS_COURT = (p: Period) => cap(new Date(p.year, p.month - 1, 15).toLocaleDateString("fr-FR", { month: "long" }));
const ficheDe = (name: string, mois?: string) => `/client?nom=${encodeURIComponent(name)}${mois ? `&mois=${mois}` : ""}`;

/** Le bandeau de fin de mois : les 3 derniers jours, puis les 5 premiers du mois suivant. */
function FinDuMois({ today }: { today: string }) {
  const data = useDataStore();
  const fin = useMemo(() => clientsAFairePayer(data, today), [data, today]);
  if (!fin) return null;
  const { period, bills } = fin;
  const n = bills.length;
  const mois = MOIS_COURT(period);
  const enCours = today.slice(0, 7) === monthKey(period);
  const reste = daysInMonth(period) - Number(today.slice(8, 10));
  const quand = !enCours ? `${mois} est fini.` : reste === 0 ? `${mois} se termine aujourd’hui.` : reste === 1 ? `${mois} se termine demain.` : `${mois} se termine dans ${reste} jours.`;
  const suivant = MOIS_COURT(addMonths(period, 1)).toLowerCase();
  if (!n)
    return (
      <div className="cl-ban rise">
        <Ill n="gerant-rosette" />
        <div>
          <b>Tout le monde a payé.</b>
          <span>
            {mois} est bouclé. Rien à faire avant fin {suivant}.
          </span>
        </div>
      </div>
    );
  return (
    <div className="cl-ban rise">
      <Ill n="gerant-buste" />
      <div>
        <b>
          Fin du mois : {n} client{n > 1 ? "s" : ""} à faire payer
        </b>
        <span>
          {quand} Envoie à chacun ce qu’il te doit, puis touche «&nbsp;Il a payé&nbsp;».
        </span>
        {!enCours && (
          <span className="cl-banw">
            {bills.map((b, i) => (
              <Fragment key={b.payer}>
                {i > 0 && ", "}
                <Link href={ficheDe(b.payer, monthKey(period))}>{prenomDe(b.payer)}</Link>
              </Fragment>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

/** Sa tête : celle de son cheval, sinon ses initiales. */
function Tete({ c }: { c: ClientDue }) {
  const h = useDataStore((s) => s.horses.find((x) => !x.isArchived && x.ownerName === c.name));
  return h ? <Face horse={h} /> : <span className="ini">{ini(c.name)}</span>;
}

const quiEst = (c: ClientDue) => (c.role === "proprietaire" ? (c.horses.length ? c.horses.join(", ") : "propriétaire") : accord(c.name, "cavalier", "cavalière"));
const sousLigne = (c: ClientDue) =>
  c.due > 0 ? (c.horses.length ? `${c.horses.join(", ")} · ${c.paieALaSeance ? "à la séance" : "au mois"}` : c.paieALaSeance ? "à la séance" : quiEst(c)) : quiEst(c);

function LigneClient({ c }: { c: ClientDue }) {
  return (
    <Link href={ficheDe(c.name)} className="cl-row">
      <Tete c={c} />
      <span className="cl-rt">
        <b>{c.name}</b>
        <small>{sousLigne(c)}</small>
      </span>
      {c.due > 0 ? (
        <span className="cl-amt">
          <small>te doit</small>
          <b>{eur(c.due)}</b>
        </span>
      ) : (
        <span className="cl-ok">à jour</span>
      )}
      <Ic n="chev" className="chev" />
    </Link>
  );
}

/**
 * Ajouter un client : un nom, propriétaire ou cavalier, et sa fiche s'ouvre.
 * Un propriétaire : on choisit tout de suite ses chevaux (ou on en crée un).
 */
function AjouterClient({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [role, setRole] = useState<PersonRole>("cavalier");
  const [chevauxDe, setChevauxDe] = useState<string | null>(null);
  const ok = () => {
    const n = nom.trim();
    if (!n) return;
    const pid = useDataStore.getState().ensurePerson(n, role);
    const vrai = useDataStore.getState().people?.find((p) => p.id === pid)?.name ?? n;
    if (role === "proprietaire") return setChevauxDe(vrai);
    onClose();
    router.push(ficheDe(vrai));
  };
  if (chevauxDe) {
    return (
      <ChevauxDuClient
        nom={chevauxDe}
        fin="Voir sa fiche"
        onLeave={onClose}
        onClose={() => {
          onClose();
          router.push(ficheDe(chevauxDe));
        }}
      />
    );
  }
  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Ajouter un client">
          <div className="grab" />
          <div className="shd">
            <b>Ajouter un client</b>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          <div className="pad cl-form">
            <input className="input" placeholder="Son nom" value={nom} autoFocus onChange={(e) => setNom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ok()} aria-label="Son nom" />
            <Seg<PersonRole>
              value={role}
              onChange={setRole}
              label="Qui est-ce ?"
              options={[
                ["cavalier", "Monte en cours"],
                ["proprietaire", "A un cheval ici"],
              ]}
            />
            <button type="button" className="btn full" disabled={!nom.trim()} onClick={ok}>
              {role === "proprietaire" ? "Ajouter et choisir ses chevaux" : "Ajouter"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Clients({ bascule }: { bascule: React.ReactNode }) {
  const data = useDataStore();
  const desk = useDesk();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [ajout, setAjout] = useState(false);
  const today = localToday();
  const period = useMemo(() => currentPeriod(), []);
  const rows = useMemo(() => clientDues(data, period), [data, period]);
  const match = (c: ClientDue) => !q || c.name.toLowerCase().includes(q.trim().toLowerCase());
  const doivent = rows.filter((c) => c.due > 0);
  const total = doivent.reduce((t, c) => t + c.due, 0);
  const n = doivent.length;
  const owe = doivent.filter(match);
  const ok = rows.filter((c) => c.due <= 0 && match(c)).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const sub = n ? (
    <>
      {n} client{n > 1 ? "s" : ""} te {n > 1 ? "doivent" : "doit"} <b>{eur(total)}</b>
    </>
  ) : (
    "Personne ne te doit rien."
  );
  // En milieu de mois, ce qui est dû est surtout la pension du mois en cours : on le dit, pour rassurer.
  const finDuMois = useMemo(() => clientsAFairePayer(data, today), [data, today]);
  const pensions = useMemo(
    () =>
      billsFor(data, period)
        .filter((b) => !b.orphan)
        .reduce((t, b) => t + Math.min(b.due, b.lines.filter((l) => /pension/i.test(l.label)).reduce((u, l) => u + l.amount, 0)), 0),
    [data, period],
  );
  const rassure =
    n > 0 && !finDuMois ? (
      <p className="cl-ras">
        {Math.round(pensions) > 0 ? `Dont ${eur(pensions)} de pensions ${deMoisDe(period)}, réglées d’habitude en fin de mois. ` : "Le mois est en cours : la plupart règlent à la fin. "}
        Normal à cette date.
      </p>
    ) : null;
  // Les pensions des chevaux sans propriétaire : dites telles quelles, jamais comptées dans ce qu'on te doit.
  const orphan = useMemo(() => billsFor(data, period).find((b) => b.orphan), [data, period]);
  const sansProprio = orphan && Math.round(orphan.total) > 0 ? (
    <p className="cl-ras">
      {(() => {
        const noms = [...new Set(orphan.lines.map((l) => l.horse).filter(Boolean))];
        const qui = noms.length > 3 ? `${noms.length} chevaux sans propriétaire` : `chevaux sans propriétaire (${noms.join(", ")})`;
        return `${n ? "Et " : ""}${eur(orphan.total)} viennent de ${qui} : personne à qui les demander pour l’instant. Ajoute leur propriétaire sur leur fiche.`;
      })()}
    </p>
  ) : null;
  const search = (
    <label className="input ch-search">
      <Ic n="search" className="" />
      <input placeholder="Chercher un client" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher un client" />
    </label>
  );
  const ajouter = (
    <button type="button" className="btn line" onClick={() => setAjout(true)}>
      <Ic n="plus" className="" />
      Ajouter un client
    </button>
  );
  const pros = (
    <p className="cl-fn">
      Le maréchal et le vétérinaire sont dans{" "}
      <Link className="lnk" href="/contacts">
        tes contacts
      </Link>{" "}
      : ce sont des pros, pas des clients.
    </p>
  );
  const vide = rows.length === 0 ? <p className="note cl-vide">Personne pour l’instant. Un nom noté dans une séance devient un client tout seul.</p> : !owe.length && !ok.length ? <p className="note cl-vide">Personne à ce nom.</p> : null;
  const feuille = ajout && <AjouterClient onClose={() => setAjout(false)} />;

  if (desk) {
    const shown = [...owe, ...ok];
    return (
      <Ecran wide className="ch-desk">
        <div className="dhead rise">
          <div>
            <p className="k">{moisDe()}</p>
            <h2>Tes clients</h2>
            <p>{sub}</p>
            {rassure}
            {sansProprio}
          </div>
          {ajouter}
        </div>
        <FinDuMois today={today} />
        <div className="ch-bar2 rise" style={{ animationDelay: ".08s" }}>
          {bascule}
          {search}
        </div>
        {vide}
        {shown.length > 0 && (
          <table className="tbl rise" style={{ animationDelay: ".14s" }}>
            <thead>
              <tr>
                <th>Client</th>
                <th>Chevaux</th>
                <th>Téléphone</th>
                <th>Paie</th>
                <th className="n">Ce mois</th>
                <th className="n">Payé</th>
                <th className="n">Te doit</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.name} className="go" onClick={() => router.push(ficheDe(c.name))}>
                  <td>
                    <Link href={ficheDe(c.name)} className="who" onClick={(e) => e.stopPropagation()}>
                      <Tete c={c} />
                      {c.name}
                    </Link>
                  </td>
                  <td className="m">{c.horses.join(", ") || quiEst(c)}</td>
                  <td className="m">{c.phone ?? ""}</td>
                  <td className="m">{c.paieALaSeance ? "à la séance" : "au mois"}</td>
                  <td className="n">{c.total ? eur(c.total) : "·"}</td>
                  <td className="n m">{c.paid ? eur(c.paid) : "·"}</td>
                  <td className="n">{c.due > 0 ? <b>{eur(c.due)}</b> : <span className="m">à jour</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pros}
        {feuille}
        <div className="end" />
      </Ecran>
    );
  }

  return (
    <Ecran>
      <Haut bascule={bascule} />
      <FinDuMois today={today} />
      <div className="cl-ttl rise">
        <p className="k">Tes clients</p>
        {n ? (
          <h2>
            {n} te {n > 1 ? "doivent" : "doit"} <span className="num">{eur(total)}</span>
          </h2>
        ) : (
          <h2>Personne ne te doit rien.</h2>
        )}
        {rassure}
        {sansProprio}
      </div>
      {rows.length > 6 && <div className="cl-find">{search}</div>}
      {owe.length > 0 && (
        <>
          <p className="k cl-lk">Ils te doivent</p>
          <div className="cl-rows">
            {owe.map((c) => (
              <LigneClient key={c.name} c={c} />
            ))}
          </div>
        </>
      )}
      {ok.length > 0 && (
        <>
          <p className="k cl-lk">Ils ne te doivent plus rien</p>
          <div className="cl-rows">
            {ok.map((c) => (
              <LigneClient key={c.name} c={c} />
            ))}
          </div>
        </>
      )}
      {vide}
      <div className="cl-tools">{ajouter}</div>
      {pros}
      {feuille}
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
  // Ce que les chevaux laissent, à eux seuls : la somme de leurs tickets (l'argent hors chevaux n'y est pas).
  const net = horses.reduce((t, h) => t + (nets[h.id] ?? 0), 0);
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
            <h2>Tes chevaux</h2>
            <p>
              Ce mois, tes chevaux {net >= 0 ? "te laissent" : "te coûtent"} <Money v={net} /> à eux tous, une fois leurs frais payés. Clique un cheval pour voir le détail.
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
              <th className="n">Part des frais partagés</th>
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
        {rows.length === 0 && (horses.length ? <p className="note">Aucun cheval dans ce filtre.</p> : <Empty ill="vide-ecurie">Aucun cheval pour l’instant. Ajoute le premier avec le bouton en haut.</Empty>)}
        <Partis />
        <p className="ch-fn">
          «&nbsp;Ce qu’il te laisse&nbsp;» : ce qu’on te paie pour lui, moins ses soins et ses frais, moins sa part des frais partagés (foin, salaires, loyer…){horses.length ? `, ${eur(each)} par cheval ce mois` : ""}.
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
      {n > 0 && (
        <div className="hello rise" style={{ animationDelay: ".06s" }}>
          <p className="ch-over0">{month}</p>
          <h2>
            {n === 1 ? "Ton cheval" : `Tes ${n} chevaux`} {net >= 0 ? (n === 1 ? "te laisse" : "te laissent") : n === 1 ? "te coûte" : "te coûtent"}{" "}
            <span className={Math.round(net) > 0 ? "in" : Math.round(net) < 0 ? "out" : "num"}>
              <CountUp value={net} />
            </span>{" "}
            ce mois.
          </h2>
          <p>Une fois leurs soins et leur part des frais communs payés. Touche un cheval pour ouvrir sa fiche.</p>
        </div>
      )}
      <ASurveiller delay={0.12} />
      <ANommer horses={anon} delay={0.14} />
      {n > 0 && (
        <div className="pad rise" style={{ animationDelay: ".2s", paddingTop: 12 }}>
          {chips}
        </div>
      )}
      {n === 0 && <Empty ill="vide-ecurie">Aucun cheval pour l’instant. Ajoute le premier ci-dessous.</Empty>}

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
      <Partis />
      <div className="end" />
    </Ecran>
  );
}
