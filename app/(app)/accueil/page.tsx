"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { useDesk } from "@/components/bs/desk";
import { addDays, weekdayIndex } from "@/components/bs/dates";
import { billsFor } from "@/lib/domain/billing";
import { seanceAmount, dayItems, toValidate, type DayItem } from "@/lib/domain/seances";
import { GoalCard } from "@/components/bs/goal-card";
import { DayBlock, useCheck } from "@/components/bs/day-block";
import { OBSTACLE_META, useParcours } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { suggestions } from "@/lib/domain/leviers";
import { reconciledNets } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";
import { Empty, Ic, Ill, Money, Page, Promo, Sec, coatFilter, eur, ini, sg } from "@/components/carnet/ui";

/**
 * L'accueil, le carnet du matin : l'objectif du mois (la gérante assise
 * dessus, son café qui fume), la journée à cocher, ce qui attend d'être
 * confirmé, une piste, un cheval à surveiller, et la promo en dernier.
 */
export default function AccueilPage() {
  return (
    <ClientGate>
      <Accueil />
    </ClientGate>
  );
}

const hhmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const MOTS = ["Une", "Deux", "Trois", "Quatre", "Cinq", "Six", "Sept", "Huit", "Neuf", "Dix"];
const enLettres = (n: number) => MOTS[n - 1] ?? String(n);
/** « 10:00 » devient « 10 h », « 10:30 » devient « 10 h 30 ». */
const heure = (s: string) => {
  const [h, m] = s.split(":");
  return `${Number(h)} h${m && m !== "00" ? ` ${m}` : ""}`;
};

function Accueil() {
  const data = useDataStore();
  const gerant = useSettingsStore((s) => s.gerant);
  const capacity = useSettingsStore((s) => s.capacity);
  const today = localToday();
  const now = hhmm();
  const items = useMemo(() => dayItems(data, today, today, now), [data, today, now]);
  const pending = useMemo(() => toValidate(data, today, now), [data, today, now]);
  const list = useMemo(() => suggestions(data, currentPeriod(), capacity).filter((s) => s.status !== "faite"), [data, capacity]);
  const action = list.find((s) => s.lever === "facturer") ?? list[0];
  const left = items.filter((i) => !i.done);
  const allDone = items.length > 0 && left.length === 0;
  const soir = Number(now.slice(0, 2)) >= 18;
  const desk = useDesk();

  const nom = gerant ? `, ${gerant}` : "";
  const next = left.find((i) => i.start);
  const sub = !items.length
    ? "Rien de prévu aujourd’hui."
    : allDone
      ? `${enLettres(items.length)} chose${items.length > 1 ? "s" : ""} prévue${items.length > 1 ? "s" : ""}, ${enLettres(items.length).toLowerCase()} chose${items.length > 1 ? "s" : ""} faite${items.length > 1 ? "s" : ""}.`
      : `${enLettres(left.length)} chose${left.length > 1 ? "s" : ""} aujourd’hui${next ? `, ${left.length > 1 ? (left.length < items.length ? "la prochaine" : "la première") : "elle"} t’attend à ${heure(next.start!)}` : ""}.`;
  const dt = cap(new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));
  const hello = (
    <div className="hello rise" style={{ animationDelay: "0.04s" }}>
      <p className="mt-dt">{dt}</p>
      <h3>
        {soir ? "Bonsoir" : "Bonjour"}
        {nom}.
      </h3>
      <p>{sub}</p>
    </div>
  );

  const journee = (
    <Sec ill="carnet-buste" title="Ta journée" action={<Link href="/planning">Planning</Link>} delay={desk ? 0.2 : 0.3}>
      {items.length === 0 ? (
        <Empty>Rien de prévu aujourd’hui. {desk ? "Clique sur « Ajouter » (ou touche N)" : "Touche le +"} pour prévoir une séance, un soin ou une tâche.</Empty>
      ) : (
        <>
          {allDone && (
            <div className="empty mt-fini">
              <Ill n="dodo" alt="Un cheval dort dans la paille." />
              <p style={{ margin: 0 }}>
                <b>Tout est fait pour aujourd’hui.</b>
                <br />
                {soir ? "Bonne soirée" : "Belle journée"}
                {nom}.
              </p>
            </div>
          )}
          <div className="rows">
            {items.map((it) => (
              <DayBlock key={it.key} it={it} />
            ))}
          </div>
        </>
      )}
    </Sec>
  );

  const confirmer = <Confirmer pending={pending} calme={allDone} delay={desk ? 0.28 : 0.4} />;
  const piste = action && (
    <Sec blk ill="piste" title="Une piste pour gagner plus" action={<Link href="/argent?vue=leviers">Toutes</Link>} delay={desk ? 0.4 : 0.5}>
      <Link href="/argent?vue=leviers" className="mt-watch">
        <span>
          <b>{action.title}</b>
          <p>{cap(action.sub)}</p>
        </span>
        <span className="in">
          {sg(action.gain)}
          <small>{action.unit}</small>
        </span>
      </Link>
    </Sec>
  );
  const cheval = <ChevalASurveiller delay={desk ? 0.44 : 0.6} />;
  const pas = <PremiersPas delay={desk ? 0.5 : 0.7} />;
  const promo = (
    <Promo
      href="/ma-fiche"
      tag="mon-ecurie.fr"
      ping
      small={desk}
      title={
        desk ? (
          "Ta fiche, c’est ta vitrine."
        ) : (
          <>
            Les cavaliers cherchent leur pension.
            <br />
            Ta fiche, c’est ta vitrine.
          </>
        )
      }
      text={desk ? "Une photo et tes places libres : c’est ce qu’ils regardent en premier." : "Une photo et tes places libres : c’est ce qu’ils regardent en premier sur ta fiche."}
      cta="Compléter ma fiche"
    />
  );

  if (!desk)
    return (
      <Page className="mt-acc">
        {hello}
        <GoalCard perch />
        {journee}
        {confirmer}
        {piste}
        {cheval}
        {pas}
        {promo}
        <div className="end" />
      </Page>
    );
  return (
    <Page wide className="mt-acc mt-desk">
      <div className="mt-dhero">
        <div className="mt-txt">
          {hello}
          <WeekGlance />
        </div>
        <GoalCard perch desk />
      </div>
      <div className="mt-cols3">
        <div>
          {journee}
          <TeamGlance />
        </div>
        <div>
          {confirmer}
          <BillsGlance />
          {piste}
        </div>
        <div>
          {cheval}
          {pas}
          {promo}
        </div>
      </div>
      <div className="end" />
    </Page>
  );
}

/** « Hier, 17 h », « Aujourd’hui, 9 h 30 », « Le 12 oct. ». */
function quand(it: DayItem, today: string) {
  const d = it.seance?.date ?? it.care?.[0]?.date ?? today;
  const jour = d === today ? "Aujourd’hui" : d === addDays(today, -1) ? "Hier" : `Le ${new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
  return it.start ? `${jour}, ${heure(it.start)}` : jour;
}

/** Ce qui a eu lieu et attend d'être confirmé : tu confirmes, ça compte. */
function Confirmer({ pending, calme, delay }: { pending: DayItem[]; calme: boolean; delay: number }) {
  const check = useCheck();
  const today = localToday();
  if (!pending.length) {
    if (!calme) return null;
    return (
      <Sec ill="confirmer" title="À confirmer" delay={delay}>
        <p className="note mt-note">Rien d’autre à confirmer. Tout ce que tu as coché compte dans ton mois.</p>
      </Sec>
    );
  }
  const [first, ...others] = pending;
  const total = pending.reduce((t, i) => t + (i.money ?? 0), 0);
  return (
    <Sec blk ill="confirmer" title="À confirmer" action={<Link href="/valider">Tout voir</Link>} delay={delay}>
      <div className="mt-confirm">
        <span>
          <b>
            {quand(first, today)}. {first.title}.
          </b>
          {(first.sub || first.money) && (
            <small>
              {first.sub}
              {first.sub && first.money ? " · " : ""}
              {first.money ? <Money v={first.money} /> : null}
            </small>
          )}
        </span>
        <button type="button" className="btn" onClick={() => check(first)} aria-label={`Confirmer : ${first.title}`}>
          Confirmer
        </button>
      </div>
      <p className="note mt-note">
        {others.length ? (
          <>
            Et {others.length} autre{others.length > 1 ? "s" : ""} : {others
              .slice(0, 2)
              .map((o) => o.title)
              .join(", ")}
            {others.length > 2 ? "…" : ""}.{" "}
            {Math.round(total) !== 0 && (
              <>
                En tout, <Money v={total} /> t’attendent.{" "}
              </>
            )}
            Tu confirmes, elles comptent.
          </>
        ) : (
          "Tu confirmes, elle compte."
        )}
      </p>
    </Sec>
  );
}

/** Le cheval qui te coûte le plus ce mois, s'il te coûte. */
function ChevalASurveiller({ delay }: { delay: number }) {
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
    return { h, net: nets[h.id], floor };
  }, [data, capacity]);
  if (!pick) return null;
  const { h, net, floor } = pick;
  return (
    <Sec blk ill="tete-fondu" illStyle={{ filter: coatFilter(h) }} title="Un cheval à surveiller" delay={delay}>
      <div className="mt-watch">
        <span>
          <b>{h.name} mange plus qu’il ne paie.</b>
          <p>{floor && h.pension ? `À ${eur(floor)} au lieu de ${eur(h.pension)}, sa pension couvrirait ses frais.` : `Ce mois, il te coûte plus qu’il ne te rapporte.`}</p>
        </span>
        <Money v={net} />
      </div>
      <p className="note mt-note">
        <Link className="lnk" href={`/ticket?id=${h.id}`}>
          Voir le ticket de {h.name}
        </Link>
      </p>
    </Sec>
  );
}

/** Le parcours de démarrage, tant qu'il n'est pas fini. */
function PremiersPas({ delay }: { delay: number }) {
  const { current, n } = useParcours();
  if (!current) return null;
  return (
    <Link href="/parcours" className="card mt-pas rise" style={{ animationDelay: `${delay}s` }}>
      <Ill n="rosette" />
      <span>
        <span className="k">
          Tes premiers pas · {n} étape{n > 1 ? "s" : ""} sur 6
        </span>
        <b>Prochaine étape : {OBSTACLE_META[current].title.toLowerCase()}</b>
        <span className="dots" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} className={i < n ? "on" : ""} />
          ))}
        </span>
      </span>
      <Ic n="chev" className="chev" />
    </Link>
  );
}

/** La semaine d'un coup d'œil : chaque jour et ce qu'il rapporte. */
function WeekGlance() {
  const data = useDataStore();
  const today = localToday();
  const monday = addDays(today, -weekdayIndex(today));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const seances = (data.seances ?? []).filter((x) => x.status !== "cancelled");
  const planned = seances.filter((x) => x.status === "planned" && x.date >= today && x.date <= days[6]).reduce((t, x) => t + seanceAmount(x), 0);
  return (
    <div className="mt-week rise" style={{ animationDelay: "0.08s" }}>
      <p className="k">
        Cette semaine en 7 jours <Link href="/planning">Planning</Link>
      </p>
      <div className="mt-wds">
        {days.map((d) => {
          const money = seances.filter((x) => x.date === d).reduce((t, x) => t + seanceAmount(x), 0);
          return (
            <Link key={d} href={`/planning?jour=${d}`} className={`mt-wd${d === today ? " td" : ""}`} aria-current={d === today ? "date" : undefined}>
              <small>{new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "narrow" })}</small>
              <b>{Number(d.slice(8))}</b>
              {Math.round(money) ? <Money v={money} /> : <span className="nil">·</span>}
            </Link>
          );
        })}
      </div>
      {Math.round(planned) > 0 && (
        <p className="note">
          Encore <b>{sg(planned)}</b> prévus d’ici dimanche.
        </p>
      )}
    </div>
  );
}

/** Ce qui reste à encaisser ce mois, les plus gros d'abord. */
function BillsGlance() {
  const data = useDataStore();
  const bills = useMemo(() => billsFor(data, currentPeriod()).filter((b) => b.due > 0).sort((a, b) => b.due - a.due), [data]);
  if (!bills.length) return null;
  const total = bills.reduce((t, b) => t + b.due, 0);
  return (
    <Sec blk ill="sacoche" title="On te doit encore" action={<Link href="/argent?vue=facturer">À facturer</Link>} delay={0.36}>
      <p className="mid mt-mid">{eur(total)}</p>
      {bills.slice(0, 4).map((b) => (
        <Link key={b.payer} href="/argent?vue=facturer" className="mt-owe">
          <span>
            <span className="ini" aria-hidden="true">
              {ini(b.payer)}
            </span>
            {b.payer}
          </span>
          <b>{eur(b.due)}</b>
        </Link>
      ))}
    </Sec>
  );
}

/** Les tâches d'équipe qui comptent aujourd'hui : en retard, du jour, en cours. */
function TeamGlance() {
  const data = useDataStore();
  const today = localToday();
  const done = data.taskLists?.find((l) => l.isDone)?.id;
  const doing = data.taskLists?.find((l) => !l.isDone && /cours/i.test(l.title))?.id;
  const tasks = (data.tasks ?? []).filter((t) => t.listId !== done && ((t.due && t.due.slice(0, 10) <= today) || t.listId === doing)).slice(0, 4);
  if (!tasks.length) return null;
  return (
    <Sec ill="brouette" title="L’équipe" action={<Link href="/equipe">Voir les tâches</Link>} delay={0.3}>
      {tasks.map((t) => {
        const late = !!t.due && t.due.slice(0, 10) < today;
        return (
          <Link key={t.id} href="/equipe" className="li">
            <span className="ini" aria-hidden="true">
              <Ic n="board" className="mt-ic" />
            </span>
            <span>
              <b>{t.title}</b>
              <small>
                {[t.forWho.join(", "), t.due ? (late ? "" : t.due.slice(0, 10) === today ? "aujourd’hui" : "") : "en cours"].filter(Boolean).join(" · ")}
                {late && (
                  <>
                    {t.forWho.length ? " · " : ""}
                    <b className="mt-late">en retard</b>
                  </>
                )}
              </small>
            </span>
            <Ic n="chev" className="chev" />
          </Link>
        );
      })}
    </Sec>
  );
}
