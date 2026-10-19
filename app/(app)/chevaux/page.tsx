"use client";

import { selonSexe } from "@/lib/domain/registre";
import Link from "next/link";
import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ClientGate } from "@/components/ui/client-gate";
import { cap } from "@/components/bs/ui";
import { Chips, CountUp, Empty, Face, Ic, Ill, Money, Page as Ecran, Pill, Sec, Seg, coatFilter, eur, eurc, ini, sg } from "@/components/carnet/ui";
import { r2 } from "@/lib/utils/arrondi";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { reconciledNets, monthBreakdown, horseTicket, estAuGerant } from "@/lib/domain/ticket";
import { suggestions } from "@/lib/domain/leviers";
import { useDesk } from "@/components/bs/desk-hook";
import { useAideIci } from "@/components/bs/nav";
import { ChevauxDuClient } from "@/components/bs/choisir-proprio";
import { useRouter, useSearchParams } from "next/navigation";
import { accord, anciensEnMots, clientDues, prenomDe, type ClientDue } from "@/lib/domain/clients";
import { billsFor, cleClient, monthKey } from "@/lib/domain/billing";
import { clientsAFairePayer } from "@/lib/domain/compte-auto";
import { addMonths, currentPeriod, daysInMonth } from "@/lib/utils/period";
import { chevauxDuMois, chevauxPresents } from "@/lib/domain/presence";
import { CARE_META, upcomingDeadlines, type Deadline } from "@/lib/domain/care";
import { localToday } from "@/lib/utils/local-date";
import type { Horse, Period, PersonRole, StableData } from "@/lib/domain/types";
import { de, moisAFacturer } from "@/lib/domain/facture";
import { Partis } from "@/components/bs/partis";
import { useFeuille } from "@/components/bs/feuille";
import { useTitreOnglet } from "@/components/bs/titre-onglet";
import { echeance } from "@/lib/utils/heure";
import { adresseClient } from "@/lib/adresse-client";

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
  useTitreOnglet(vue === "chevaux" ? "Chevaux" : null);
  const versChevaux = () => {
    choisir("chevaux");
    window.scrollTo({ top: 0 });
  };
  return vue === "clients" ? <Clients bascule={bascule} versChevaux={versChevaux} /> : <Chevaux bascule={bascule} />;
}

const moisDe = () => cap(new Date().toLocaleDateString("fr-FR", { month: "long" }));
const formule = (h: Horse) => (h.pensionType ?? "pension").toLowerCase();
const quand = (d: Deadline) => echeance(d.daysLeft);
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
const deMoisDe = (p: Period) => de(new Date(p.year, p.month - 1, 15).toLocaleDateString("fr-FR", { month: "long" }));
const MOIS_COURT = (p: Period) => cap(new Date(p.year, p.month - 1, 15).toLocaleDateString("fr-FR", { month: "long" }));
/** « Faire les factures d'octobre » : toutes celles du mois, après un aperçu de la liste. */
function FacturesDuMois({ data, today }: { data: StableData; today: string }) {
  const { period, clients } = useMemo(() => moisAFacturer(data, today), [data, today]);
  if (!clients.length) return null;
  const mk = `${period.year}-${String(period.month).padStart(2, "0")}`;
  return (
    <Link href={`/facture?lot=${mk}`} className="btn line full cl-lot">
      <Ic n="doc" className="" />
      Faire les factures {deMoisDe(period)}
    </Link>
  );
}
const ficheDe = (name: string, mois?: string) => adresseClient(name, mois);

/** Le bandeau de fin de mois : les 3 derniers jours, puis les 5 premiers du mois suivant. */
function FinDuMois({ today }: { today: string }) {
  const data = useDataStore();
  const fin = useMemo(() => clientsAFairePayer(data, today), [data, today]);
  if (!fin) return null;
  const { period, clients, total } = fin;
  const n = clients.length;
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
          Fin du mois : {n} client{n > 1 ? "s" : ""} te {n > 1 ? "doivent" : "doit"} {eurc(total)}
        </b>
        <span>
          {quand} Envoie à chacun ce qu’il te doit, puis touche «&nbsp;Il a payé&nbsp;».
        </span>
        {!enCours && (
          <span className="cl-banw">
            {clients.map((c, i) => (
              <Fragment key={c.name}>
                {i > 0 && ", "}
                <Link href={ficheDe(c.name, monthKey(period))}>{prenomDe(c.name)}</Link>
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

/** Les impayés des mois d'avant, chacun avec son mois : « dont 350 € de septembre ». */
const anciensDits = (c: ClientDue, period: { year: number; month: number }) => anciensEnMots(c, period, eurc);

function LigneClient({ c, period }: { c: ClientDue; period: { year: number; month: number } }) {
  return (
    <Link href={ficheDe(c.name)} className="cl-row">
      <Tete c={c} />
      <span className="cl-rt">
        <b>{c.name}</b>
        <small>{sousLigne(c)}</small>
        {c.anciens.length > 0 && <small>{anciensDits(c, period)}</small>}
        {c.aRendre > 0 && <small>À lui rendre {eurc(c.aRendre)}</small>}
        {c.avance > 0 && <small>Avance {eurc(c.avance)}</small>}
      </span>
      {c.due > 0 ? (
        <span className="cl-amt">
          <small>te doit</small>
          <b>{eurc(c.due)}</b>
        </span>
      ) : (
        <span className="cl-ok">à jour</span>
      )}
      <Ic n="chev" className="chev" />
    </Link>
  );
}

/**
 * Les chevaux sans propriétaire, en une carte à toucher : leur tête, combien
 * ils sont (ou le nom du seul), « À qui demander la pension ? » et ce qui
 * attend. Un seul cheval ouvre sa fiche (le propriétaire s'y ajoute) ;
 * plusieurs ouvrent l'onglet Chevaux.
 */
function SansProprio({ lignes, total, versChevaux }: { lignes: { horse?: string; horseId?: string }[]; total: number; versChevaux: () => void }) {
  const horses = useDataStore((s) => s.horses);
  const ids = [...new Set(lignes.map((l) => l.horseId ?? horses.find((h) => h.name === l.horse)?.id).filter((x): x is string => !!x))];
  const noms = [...new Set(lignes.map((l) => l.horse).filter(Boolean))];
  const nb = Math.max(ids.length, noms.length, 1);
  const premier = horses.find((h) => h.id === ids[0]);
  const corps = (
    <>
      {premier ? <Face horse={premier} /> : <span className="ini" aria-hidden="true"><Ic n="horse" className="" /></span>}
      <span className="cl-rt">
        <b>{nb === 1 ? `${premier?.name ?? noms[0] ?? "Un cheval"} sans propriétaire` : `${nb} chevaux sans propriétaire`}</b>
        <small>À qui demander la pension ?</small>
      </span>
      <span className="cl-amt">
        <small>en attente</small>
        <b>{eur(total)}</b>
      </span>
      <Ic n="chev" className="chev" />
    </>
  );
  if (nb === 1 && premier)
    return (
      <Link href={`/ticket?id=${premier.id}`} className="cl-row cl-orph">
        {corps}
      </Link>
    );
  return (
    <button type="button" className="cl-row cl-orph" onClick={versChevaux}>
      {corps}
    </button>
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
  const ref = useFeuille(onClose, { verrou: true });
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
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Ajouter un client" ref={ref}>
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

function Clients({ bascule, versChevaux }: { bascule: React.ReactNode; versChevaux: () => void }) {
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
  const total = r2(doivent.reduce((t, c) => t + c.due, 0));
  const n = doivent.length;
  const owe = doivent.filter(match);
  const ok = rows.filter((c) => c.due <= 0 && match(c)).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const sub = n ? (
    <>
      {n} client{n > 1 ? "s" : ""} te {n > 1 ? "doivent" : "doit"} <b>{eurc(total)}</b>
    </>
  ) : (
    rows.length ? "Tout le monde t’a payé." : "Pas encore de client."
  );
  // En milieu de mois, ce qui est dû est surtout la pension du mois en cours : on le dit, pour rassurer.
  const finDuMois = useMemo(() => clientsAFairePayer(data, today), [data, today]);
  const pensions = useMemo(
    () =>
      billsFor(data, period)
        .filter((b) => !b.orphan)
        // Une pension annulée par un avoir n'est plus due : ce qui reste dû vient d'ailleurs (un soin refacturé).
        .reduce((t, b) => t + Math.max(0, Math.min(b.due, b.lines.filter((l) => /pension/i.test(l.label)).reduce((u, l) => u + l.amount, 0) - (b.avoirs ?? []).reduce((u, a) => u + a.amount, 0))), 0),
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
  const sansProprio = orphan && Math.round(orphan.total) > 0 ? <SansProprio lignes={orphan.lines} total={orphan.total} versChevaux={versChevaux} /> : null;
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
      Le maréchal et le véto sont dans{" "}
      <Link className="lnk" href="/contacts">
        les pros
      </Link>
      .
    </p>
  );
  const vide = rows.length === 0 ? <p className="note cl-vide">Un nom noté dans une séance devient un client tout seul.</p> : !owe.length && !ok.length ? <p className="note cl-vide">Personne à ce nom.</p> : null;
  const feuille = ajout && <AjouterClient onClose={() => setAjout(false)} />;

  if (desk) {
    const shown = [...owe, ...ok];
    // Les avoirs du mois et l'argent rendu, lus sur les notes du mois : « Ce mois − Payé − Avoirs = Te doit »
    // se vérifie au crayon (Payé : ce qui est resté payé, une fois l'argent rendu après un avoir retiré).
    const notesMois = new Map(billsFor(data, period).filter((b) => !b.orphan).map((b) => [cleClient(b.payer), b]));
    const noteDe = (c: (typeof shown)[number]) => notesMois.get(cleClient(c.name));
    const avoirDe = (c: (typeof shown)[number]) => r2((noteDe(c)?.avoirs ?? []).reduce((t, a) => t + a.amount, 0));
    const payeDe = (c: (typeof shown)[number]) => r2(c.paid - (noteDe(c)?.rendu ?? 0));
    const avecAvoirs = shown.some((c) => avoirDe(c) > 0);
    return (
      <Ecran wide className="ch-desk">
        <div className="dhead rise">
          <div>
            <p className="k">{moisDe()}</p>
            <h2>Tes clients</h2>
            <p>{sub}</p>
            {rassure}
            {sansProprio}
            <FacturesDuMois data={data} today={today} />
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
                <th>Paiement</th>
                <th className="n">Ce mois</th>
                <th className="n">Payé</th>
                {avecAvoirs && <th className="n">Avoirs</th>}
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
                  <td className="n m">{payeDe(c) ? eur(payeDe(c)) : "·"}</td>
                  {avecAvoirs && <td className="n m">{avoirDe(c) ? sg(-avoirDe(c)) : "·"}</td>}
                  <td className="n">
                    {c.due > 0 ? <b>{eurc(c.due)}</b> : <span className="m">à jour</span>}
                    {c.anciens.length > 0 && <small className="m" style={{ display: "block" }}>{anciensDits(c, period)}</small>}
                  </td>
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
            {n} te {n > 1 ? "doivent" : "doit"} <span className="num">{eurc(total)}</span>
          </h2>
        ) : (
          <h2>{rows.length ? "Tout le monde t’a payé." : "Pas encore de client."}</h2>
        )}
        {rassure}
        {sansProprio}
        <FacturesDuMois data={data} today={today} />
      </div>
      {rows.length > 6 && <div className="cl-find">{search}</div>}
      {owe.length > 0 && (
        <>
          <p className="k cl-lk">Ils te doivent</p>
          <div className="cl-rows">
            {owe.map((c) => (
              <LigneClient key={c.name} c={c} period={period} />
            ))}
          </div>
        </>
      )}
      {ok.length > 0 && (
        <>
          <p className="k cl-lk">Ils ne te doivent plus rien</p>
          <div className="cl-rows">
            {ok.map((c) => (
              <LigneClient key={c.name} c={c} period={period} />
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

/** Le cheval en pension qui te coûte le plus ce mois, s'il te coûte, avec ce qui presse pour lui. */
function ASurveiller({ delay }: { delay: number }) {
  const data = useDataStore();
  const capacity = useSettingsStore((s) => s.capacity);
  const pick = useMemo(() => {
    const p = currentPeriod();
    const nets = reconciledNets(data, p);
    // Les chevaux du gérant coûtent sans pension, c’est attendu : ils ne sont pas « à surveiller ».
    const horses = data.horses.filter((h) => !h.isArchived && !estAuGerant(h) && nets[h.id] !== undefined && nets[h.id] < 0);
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
          <b>{selonSexe(h, `${h.name} mange plus qu’il ne paie.`, `${h.name} mange plus qu’elle ne paie.`, `${h.name} coûte plus que sa pension.`)}</b>
          <small>
            {late && `${cap(CARE_META[late.kind].label.toLowerCase())} en retard de ${-late.daysLeft} jour${-late.daysLeft > 1 ? "s" : ""}. `}
            {floor && h.pension ? `À ${eur(floor)} au lieu de ${eur(h.pension)}, sa pension couvrirait ses frais.` : selonSexe(h, "Ce mois, il te coûte plus qu’il ne te rapporte.", "Ce mois, elle te coûte plus qu’elle ne te rapporte.", "Ce mois, ce cheval te coûte plus qu’il ne te rapporte.")}
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
    <Sec ill="carnet-buste" title="Donne un nom à tes chevaux" delay={delay}>
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
  // Les chevaux du mois, comme Mon bilan : un cheval parti dans le mois y garde son ticket.
  const horses = useMemo(() => chevauxDuMois(data, period), [data, period]);
  const partage = useMemo(() => chevauxPresents(data, period).length, [data, period]);
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
        <small>{[h.isArchived && h.exitDate ? `parti le ${new Date(h.exitDate + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : "", formule(h), h.ownerName].filter(Boolean).join(" · ")}</small>
      </span>
      <NetPill v={nets[h.id] ?? 0} />
    </Link>
  );

  if (desk) {
    const shown = f === "pos" ? pos : f === "neg" ? neg : f === "prevoir" ? dueHorses : sorted;
    const rows = shown.map((h) => ({ h, t: horseTicket(data, h.id, period), net: nets[h.id] ?? 0, due: dues.filter((d) => d.horseId === h.id) }));
    const tot = rows.reduce((a, r) => ({ rev: a.rev + r.t.revenue, dir: a.dir + r.t.direct, share: a.share + r.t.share, net: a.net + r.net }), { rev: 0, dir: 0, share: 0, net: 0 });
    const nPos = rows.filter((r) => r.net > 0).length;
    const each = partage ? m.sharedTotal / partage : 0;
    return (
      <Ecran wide className="ch-desk">
        <div className="dhead rise">
          <div>
            <p className="k">{month}</p>
            <h2>Tes chevaux</h2>
            <p>
              Ce mois, tes chevaux {net >= 0 ? "te laissent" : "te coûtent"} <Money v={net} plain /> à eux tous, une fois leurs frais payés. Clique un cheval pour voir le détail.
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
              <th className="n">Sa part des frais</th>
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
                  {due.map((d) => {
                    const late = d.status === "overdue";
                    const txt = `${CARE_META[d.kind].label.toLowerCase()}${late ? ", " : " "}${quand(d)}`;
                    return (
                      <span key={d.kind}>{late ? <b>{txt}</b> : txt}</span>
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
        {rows.length === 0 && (horses.length ? <p className="note">Aucun cheval dans ce filtre.</p> : <Empty ill="vide-ecurie">Aucun cheval pour l’instant. Ajoute le premier.</Empty>)}
        <Partis />
        <p className="ch-fn">
          «&nbsp;Ce qu’il te laisse&nbsp;» : ce qu’on te paie pour lui, moins ses soins et ses frais, moins sa part des frais de l’écurie (foin, salaires, loyer…){horses.length ? `, ${eur(each)} par cheval ce mois` : ""}.
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
              <CountUp value={net} fmt={(x) => eur(Math.abs(x))} />
            </span>{" "}
            ce mois.
          </h2>
          <p>Une fois payés leurs soins et leur part des frais. Touche un cheval pour ouvrir sa fiche.</p>
        </div>
      )}
      <ASurveiller delay={0.12} />
      <ANommer horses={anon} delay={0.14} />
      {n > 0 && (
        <div className="pad rise" style={{ animationDelay: ".2s", paddingTop: 12 }}>
          {chips}
        </div>
      )}
      {n === 0 && <Empty ill="vide-ecurie">Aucun cheval pour l’instant. Ajoute le premier.</Empty>}

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
