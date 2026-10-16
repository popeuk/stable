"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Empty, Face, Ic, Money, Page as Ecran, Pill, Portrait, Sec, Seg, Tip, eur, sg } from "@/components/carnet/ui";
import { COATS } from "@/components/bs/horse-face";
import { useDesk } from "@/components/bs/desk";
import { useParcours } from "@/components/bs/parcours";
import { avecArticle } from "@/lib/domain/leviers";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { horseTicket, reconciledNets, type HorseTicket } from "@/lib/domain/ticket";
import { CARE_META, horseCareLog, upcomingDeadlines, type CareKind } from "@/lib/domain/care";
import { currentPeriod, addMonths } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";
import type { Horse } from "@/lib/domain/types";
import { msgFairePayer } from "@/lib/utils/esc";

/**
 * La fiche d'un cheval : son portrait qui respire, puis le ticket du mois
 * qui s'imprime (ce qui est entré, ce qui est sorti, sa part du pot commun,
 * le total), une idée concrète, son carnet et son planning.
 */
export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <TicketRoute />
      </Suspense>
    </ClientGate>
  );
}

function TicketRoute() {
  const id = useSearchParams().get("id");
  const horse = useDataStore((s) => s.horses.find((h) => h.id === id));
  if (!id || !horse) {
    return (
      <Ecran>
        <Empty>Ce cheval n’est plus dans l’écurie.</Empty>
        <div className="ch-after">
          <Link href="/chevaux" className="btn line full">
            Mes chevaux
          </Link>
        </div>
      </Ecran>
    );
  }
  return <Ticket horse={horse} />;
}

/** L'icône d'un soin dans le carnet. */
const CARE_IC: Partial<Record<CareKind, string>> = {
  ferrure: "shoe",
  entrainement: "cal",
  cours_collectif: "cal",
  cours_individuel: "cal",
  concours: "flag",
  document: "doc",
  prestation: "cal",
};
const careIc = (k: CareKind) => CARE_IC[k] ?? "syringe";

/** Le conseil du ticket : une phrase forte, puis la suite. */
function tipFor(h: Horse, t: HorseTicket): [string, string] {
  if (t.net >= 0) return [`${h.name} paie ses soins et sa part des frais communs.`, `Une fois tout payé, il te laisse ${eur(t.net)} ce mois.`];
  const soins = t.lines.filter((l) => l.kind === "out" && /orthop|ost|compl|dent|vaccin|vermif/i.test(l.label));
  const big = (soins.length ? soins : t.lines.filter((l) => l.kind === "out")).sort((a, b) => a.amount - b.amount)[0];
  if (big && -big.amount > 20)
    return [
      "Sa pension ne suffit pas à payer ses soins.",
      `Si tu fais payer « ${big.label.toLowerCase()} »${h.ownerName ? ` à ${h.ownerName}` : " à son propriétaire"}, il te laisserait ${sg(t.net - big.amount)}.`,
    ];
  const breakeven = Math.ceil((t.direct + t.share - (t.revenue - (h.pension ?? 0))) / 10) * 10;
  return [`Une pension à ${eur(breakeven)} au lieu de ${eur(h.pension ?? 0)} suffirait.`, "Sa pension est plus basse que ce qu’il te coûte. À ce prix, tu ne perdrais plus d’argent avec lui."];
}

const jour = (d: string, month: "short" | "long" = "short") => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month });

function Ticket({ horse }: { horse: Horse }) {
  const router = useRouter();
  const data = useDataStore();
  const archiveHorse = useDataStore((s) => s.archiveHorse);
  const restoreHorse = useDataStore((s) => s.restoreHorse);
  const openNoter = useUiStore((s) => s.openNoter);
  const lastLine = useUiStore((s) => s.lastLine);
  const { pass, setupDone, parcours } = useParcours();
  const [offset, setOffset] = useState(0);
  const [seg, setSeg] = useState<"ticket" | "carnet" | "planning">("ticket");
  const desk = useDesk();
  const say = useUiStore((s) => s.say);
  const openSeance = useUiStore((s) => s.openSeance);
  const period = useMemo(() => addMonths(currentPeriod(), offset), [offset]);
  const t = useMemo(() => horseTicket(data, horse.id, period), [data, horse.id, period]);
  const nets = useMemo(() => reconciledNets(data, period), [data, period]);
  const net = nets[horse.id] ?? Math.round(t.net);
  const today = localToday();
  const log = horseCareLog(data, horse.id, today).slice(0, 6);
  const deadlines = upcomingDeadlines(data, today)
    .filter((d) => d.horseId === horse.id)
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const due = deadlines.filter((d) => d.status !== "ok");
  const monthName = new Date(period.year, period.month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: offset ? "numeric" : undefined });
  const nHorses = data.horses.filter((h) => !h.isArchived).length;

  // Le plus gros frais du mois pas encore refacturé au propriétaire.
  const rebill = data.directExpenses
    .filter((e) => e.horseId === horse.id && !e.rebillRevenueId && e.date.startsWith(`${period.year}-${String(period.month).padStart(2, "0")}`) && e.amount > 20)
    .sort((a, b) => b.amount - a.amount)[0];
  const seances = (data.seances ?? [])
    .filter((x) => x.horseIds.includes(horse.id) && x.status !== "cancelled" && x.date >= today)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .slice(0, 12);

  useEffect(() => {
    if (setupDone && !parcours.ticket) pass("ticket");
  }, [setupDone, parcours.ticket, pass]);

  const sub = [
    horse.pensionType,
    horse.ownerName && `propriétaire ${horse.ownerName}`,
    [horse.coat && horse.coat in COATS ? COATS[horse.coat as keyof typeof COATS].label.toLowerCase() : "", horse.birthYear ? `${new Date().getFullYear() - horse.birthYear} ans` : ""].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
  const [tipB, tipRest] = tipFor(horse, t);

  const top = (
    <>
      <Portrait horse={horse} />
      <div className="hello rise" style={{ animationDelay: ".15s" }}>
        <h2>{horse.name}</h2>
        <p>{sub || "pension"}</p>
        <Link href={`/saisie/cheval?edit=${horse.id}`} className="lnk ch-edit">
          Modifier sa fiche
        </Link>
      </div>
    </>
  );
  const mnav = (
    <div className="ch-mnav rise" style={{ animationDelay: ".2s" }}>
      <button type="button" onClick={() => setOffset(offset - 1)} aria-label="Mois précédent">
        <Ic n="back" className="" />
      </button>
      <b>{monthName}</b>
      <button type="button" onClick={() => setOffset(Math.min(0, offset + 1))} disabled={offset === 0} aria-label="Mois suivant">
        <Ic n="chev" className="" />
      </button>
    </div>
  );

  const ticket = (
    <>
      <Sec ill="sacoche" title={net >= 0 ? `Ce que ${horse.name} te laisse` : `Ce que ${horse.name} te coûte`} delay={0.3}>
        {t.lines.length === 0 ? (
          <p className="note">Rien de noté ce mois-ci. Ajoute sa pension ou un soin pour voir son ticket.</p>
        ) : (
          <p className="note ch-lead">
            {net >= 0 ? (
              <>
                Soins et foin payés, {horse.name} te laisse <Money v={net} /> ce mois.
              </>
            ) : (
              `${horse.name} mange plus qu’il ne paie.`
            )}
          </p>
        )}
        <div className="ticket print" key={`${period.year}-${period.month}`}>
          {t.lines.map((l) => (
            <div key={l.key} className={`r${lastLine && lastLine.horseId === horse.id && lastLine.sourceId === l.sourceId ? " new" : ""}`}>
              <span>
                {l.kind === "share" ? (
                  <Link href={`/part?id=${horse.id}`} className="lnk">
                    {l.label}
                  </Link>
                ) : (
                  l.label
                )}
                {l.kind === "share" ? <small>foin, loyer, salaires… ÷ {nHorses}</small> : l.date && <small>{jour(l.date)}</small>}
              </span>
              <Money v={l.amount} />
            </div>
          ))}
          <div className="r tot">
            <span>{net >= 0 ? "Il te laisse" : "Il te coûte"}</span>
            <Money v={net} />
          </div>
        </div>
      </Sec>
      <div className="ch-after rise" style={{ animationDelay: ".4s" }}>
        {offset === 0 && t.lines.length > 0 && (
          <Tip>
            <b>{tipB}</b> {tipRest}
          </Tip>
        )}
        {offset === 0 && t.lines.length > 0 && net < 0 && rebill && (
          <button
            type="button"
            className="btn full ch-tall"
            onClick={() => {
              const st = useDataStore.getState();
              const snap = { revenues: st.revenues, directExpenses: st.directExpenses };
              st.rebillExpense(rebill.id);
              say(msgFairePayer(rebill.label, horse.ownerName, eur(rebill.amount)), () => useDataStore.setState(snap));
            }}
          >
            Faire payer {avecArticle(rebill.label)} à {horse.ownerName || "son propriétaire"} · +{eur(rebill.amount)}
          </button>
        )}
        <button type="button" className="btn line full" onClick={() => openNoter({ horseIds: [horse.id] })}>
          <Ic n="plus" className="" />
          Noter quelque chose pour {horse.name}
        </button>
      </div>
    </>
  );

  const aPrevoir = deadlines.length > 0 && (
    <Sec blk={due.length > 0} ill="confirmer" title="À prévoir">
      <div className="rows">
        {deadlines.map((d) => (
          <button key={d.kind} type="button" className="li" onClick={() => openNoter({ kind: d.kind, horseIds: [horse.id] })}>
            <span className="ch-ico">
              <Ic n={careIc(d.kind)} className="" />
            </span>
            <span>
              <b>{CARE_META[d.kind].label}</b>
              <small className={d.status === "overdue" ? "ch-late" : undefined}>
                {d.daysLeft < 0 ? `en retard de ${-d.daysLeft} j` : d.daysLeft === 0 ? "aujourd’hui" : `dans ${d.daysLeft} j, le ${jour(d.dueDate, "long")}`}
              </small>
            </span>
            <Ic n="chev" className="chev" />
          </button>
        ))}
      </div>
      {due.length === 0 && <p className="note">Rien d’urgent. Touche un soin pour le noter quand il est fait.</p>}
    </Sec>
  );

  const carnet = (
    <Sec ill="carnet-buste" title="Son carnet">
      {log.length === 0 && <p className="note">Rien de noté pour l’instant. Ses soins (vaccin, maréchal, dentiste…) apparaîtront ici.</p>}
      <div className="rows">
        {log.map((e) => (
          <div key={e.id} className="li">
            <span className="ch-ico">
              <Ic n={careIc(e.kind)} className="" />
            </span>
            <span>
              <b>{e.label ? `${CARE_META[e.kind].label} · ${e.label}` : CARE_META[e.kind].label}</b>
              <small>
                {jour(e.date, "long")}
                {e.provider ? ` · ${e.provider}` : ""}
              </small>
            </span>
            {e.cost ? <Money v={-e.cost} /> : e.revenue ? <Money v={e.revenue} /> : <span />}
          </div>
        ))}
      </div>
    </Sec>
  );

  const planning = (
    <>
      {seances.length === 0 ? (
        <Empty>Aucune séance prévue pour {horse.name}. Ajoute un cours ou une sortie ci-dessous.</Empty>
      ) : (
        <Sec ill="carnet" title="À venir">
          <div className="rows">
            {seances.map((x) => (
              <button key={x.id} type="button" className="li" onClick={() => openSeance(x.id)}>
                <span className="ch-ico">
                  <Ic n="cal" className="" />
                </span>
                <span>
                  <b>{x.title}</b>
                  <small>
                    {new Date(x.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · {x.start}
                  </small>
                </span>
                <Ic n="chev" className="chev" />
              </button>
            ))}
          </div>
        </Sec>
      )}
      <div className="ch-after">
        <button type="button" className="btn line full" onClick={() => openNoter({ mode: "seance", horseIds: [horse.id] })}>
          <Ic n="plus" className="" />
          Planifier une séance
        </button>
      </div>
    </>
  );

  const leave = horse.isArchived ? (
    <div className="ch-leave">
      <p className="note">{horse.exitDate ? `Parti le ${jour(horse.exitDate, "long")}. ` : "Parti. "}Son argent reste dans les mois où il était là.</p>
      <button type="button" className="btn ghost" onClick={() => restoreHorse(horse.id)}>
        {horse.name} revient à l’écurie
      </button>
    </div>
  ) : (
    <div className="ch-leave">
      <button
        type="button"
        className="btn ghost"
        onClick={() => {
          if (window.confirm(`${horse.name} quitte l’écurie aujourd’hui ? Ce qu’il a rapporté et coûté reste dans les mois où il était là. Sa pension ne sera plus comptée les mois suivants. Tu le retrouves dans les chevaux partis.`)) {
            archiveHorse(horse.id);
            router.push("/chevaux");
          }
        }}
      >
        {horse.name} quitte l’écurie
      </button>
    </div>
  );

  if (desk) {
    return (
      <Ecran wide className="ch-desk">
        <HorseStrip current={horse.id} nets={nets} />
        <div className="ch-fiche-top">
          {top}
          {mnav}
        </div>
        <div className="cols2 ch-cols">
          <div>{ticket}</div>
          <div className="ch-stick">
            {aPrevoir}
            {planning}
            {carnet}
          </div>
        </div>
        {leave}
        <div className="end" />
      </Ecran>
    );
  }

  const panels: Record<typeof seg, ReactNode> = {
    ticket,
    carnet: (
      <>
        {aPrevoir}
        {carnet}
      </>
    ),
    planning,
  };

  return (
    <Ecran>
      {top}
      {mnav}
      <div className="ch-tabs rise" style={{ animationDelay: ".24s" }}>
        <Seg
          value={seg}
          onChange={setSeg}
          label={`Fiche de ${horse.name}`}
          options={[
            ["ticket", "Ticket"],
            ["carnet", "Carnet"],
            ["planning", "Planning"],
          ]}
        />
      </div>
      <div role="tabpanel">{panels[seg]}</div>
      {leave}
      <div className="end" />
    </Ecran>
  );
}

/** Ordinateur : tous les chevaux en bandeau, pour passer d'une fiche à l'autre. */
function HorseStrip({ current, nets }: { current: string; nets: Record<string, number> }) {
  const horses = useDataStore((s) => s.horses);
  return (
    <nav className="ch-strip rise" aria-label="Changer de cheval">
      {horses
        .filter((h) => !h.isArchived)
        .map((h) => {
          const v = Math.round(nets[h.id] ?? 0);
          return (
            <Link key={h.id} href={`/ticket?id=${h.id}`} aria-current={h.id === current ? "page" : undefined}>
              <Face horse={h} />
              {h.name}
              <Pill tone={v > 0 ? "in" : v < 0 ? "out" : undefined}>{sg(v)}</Pill>
            </Link>
          );
        })}
    </nav>
  );
}
