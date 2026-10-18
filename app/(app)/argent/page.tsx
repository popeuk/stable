"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { cap, esc } from "@/components/bs/ui";
import { PORTEE_PREVU, plannedRest } from "@/components/bs/goal-card";
import { phrasePistes } from "@/lib/domain/objectif";
import { partageLabel, repartition } from "@/lib/domain/presence";
import { useDesk } from "@/components/bs/desk-hook";
import { Chips, CountUp, Empty, Ic, Ill, Money, Page, Sec, Seg, eur, sg, type IllName } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { usePeriodStore } from "@/stores/period-store";
import { useUiStore } from "@/stores/ui-store";
import { libelleFrais } from "@/components/bs/parcours";
import { estEstimation } from "@/lib/domain/estimation";
import { barreDuMois, ilFautPensions, memePlein, resteOuManque } from "@/lib/domain/lecture";
import { monthBreakdown, seuilEtPlaces } from "@/lib/domain/ticket";
import { suggestions, leverPotential, type Lever, type Suggestion } from "@/lib/domain/leviers";
import { clientDues } from "@/lib/domain/clients";
import { seanceAmount } from "@/lib/domain/seances";
import { factureDeLigne, messageFacturee, type LigneArgent } from "@/lib/domain/corriger";
import { currentPeriod, dateInPeriod, samePeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";
import { addDays, weekdayIndex } from "@/components/bs/dates";
import { montantEnTexte, montantOuZero } from "@/lib/utils/montant";

/**
 * Mon bilan : le chiffre du mois en tête, puis ce qui rentre
 * et ce qui sort (d'où ça vient), puis les séances semaine par semaine, une
 * piste pour gagner plus et les explications. Encaisser se fait à un seul
 * endroit, l'onglet Clients : l'ancienne vue Facturer y mène. Les leviers
 * (remplir, faire payer, dépenser mieux) et tous les mouvements à corriger
 * ont leur onglet. Rendu : le carnet illustré.
 */
type Vue = "mois" | "leviers" | "mouvements";
const VUES: [Vue, string][] = [
  ["mois", "Le mois"],
  ["leviers", "Gagner plus"],
  ["mouvements", "Historique"],
];
const TITRES: Record<Vue, string> = { mois: "Mon bilan", leviers: "Idées pour gagner plus", mouvements: "Ce qui rentre et ce qui sort" };

/** Le pictogramme d'une ligne d'argent, d'après son libellé. */
function icFor(label: string): string {
  const l = label.toLowerCase();
  if (/pension|retraite|box/.test(l)) return "horse";
  if (/foin/.test(l)) return "hay";
  if (/loyer|fermage|eau|électricité|electricite/.test(l)) return "home";
  if (/granul|aliment|orge|avoine/.test(l)) return "board";
  if (/liti|paille|copeau/.test(l)) return "list";
  if (/assurance|compta|banque/.test(l)) return "doc";
  if (/maréchal|marechal|ferr|parage/.test(l)) return "shoe";
  if (/soin|véto|veto|vacc|vermif|dentiste|ostéo|osteo|compl|pharma/.test(l)) return "syringe";
  if (/salaire|cours|séance|seance|balade|stage|travail|monit/.test(l)) return "user";
  return "euro";
}
const monthName = (y: number, m: number) => new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long" });
/** L'adresse demande d'ouvrir le champ de l'objectif (« Te fixer un objectif ? » de l'accueil). */
const objectifDemande = () => {
  try {
    return new URLSearchParams(window.location.search).get("objectif") === "1";
  } catch {
    return false;
  }
};

export default function Page_() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <Argent />
      </Suspense>
    </ClientGate>
  );
}

function Argent() {
  const router = useRouter();
  const brut = useSearchParams().get("vue");
  const vue: Vue = VUES.some(([k]) => k === brut) ? (brut as Vue) : "mois";
  // Encaisser, c'est dans Clients : l'ancienne adresse de Facturer y mène.
  useEffect(() => {
    if (brut === "facturer") router.replace("/chevaux?vue=clients");
  }, [brut, router]);
  const active = usePeriodStore((s) => s.active);
  const step = usePeriodStore((s) => s.step);
  const isNow = samePeriod(active, currentPeriod());
  const desk = useDesk();
  const label = cap(new Date(active.year, active.month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: isNow ? undefined : "numeric" }));
  return (
    <Page wide={desk}>
      <h1 className="ar-sr">{TITRES[vue] ?? TITRES.mois}</h1>
      <div className="ar-mnav">
        <button type="button" onClick={() => step(-1)} aria-label="Mois précédent">
          <Ic n="chevL" className="ar-ic" />
        </button>
        <b>{label}</b>
        <button type="button" onClick={() => step(1)} aria-label="Mois suivant" disabled={isNow}>
          <Ic n="chev" className="ar-ic" />
        </button>
      </div>
      <div className="ar-bseg">
        <Seg value={vue} onChange={(v) => router.replace(v === "mois" ? "/argent" : `/argent?vue=${v}`)} options={VUES} label="Vues de Mon bilan" />
      </div>
      {vue === "mois" && <Mois />}
      {vue === "leviers" && <Leviers />}
      {vue === "mouvements" && <Mouvements />}
      <div className="end" />
    </Page>
  );
}

/* ---------------- Le mois ---------------- */
function Mois() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const objective = useSettingsStore((s) => s.objective);
  const setObjective = useSettingsStore((s) => s.setObjective);
  // « Te fixer un objectif ? » sur l'accueil ouvre directement le champ.
  const [editGoal, setEditGoal] = useState(() => objectifDemande());
  const m = useMemo(() => monthBreakdown(data, active), [data, active]);
  const capacity = useSettingsStore((s) => s.capacity);
  const places = seuilEtPlaces(m, capacity);
  const dues = useMemo(() => clientDues(data, active).filter((c) => c.due > 0), [data, active]);
  const duTotal = dues.reduce((t, c) => t + c.due, 0);
  const isNow = samePeriod(active, currentPeriod());
  const today = localToday();
  const rest = useMemo(() => (isNow ? plannedRest(data, today) : 0), [data, today, isNow]);

  // Semaine par semaine : séances et soins du mois, prévus hachurés.
  const weeks = useMemo(() => {
    const first = `${active.year}-${String(active.month).padStart(2, "0")}-01`;
    let w = addDays(first, -weekdayIndex(first));
    const out: { label: string; done: number; planned: number; now: boolean }[] = [];
    while (w.slice(0, 7) <= first.slice(0, 7)) {
      const all = Array.from({ length: 7 }, (_, i) => addDays(w, i));
      const days = new Set(all.filter((d) => dateInPeriod(d, active)));
      if (days.size) {
        const ss = (data.seances ?? []).filter((s) => days.has(s.date) && s.status !== "cancelled");
        const done = ss.filter((s) => s.status === "done").reduce((t, s) => t + seanceAmount(s), 0);
        const planned = ss.filter((s) => s.status === "planned").reduce((t, s) => t + seanceAmount(s), 0);
        out.push({ label: `${Number([...days][0].slice(8))}`, done, planned, now: all.includes(today) });
      }
      w = addDays(w, 7);
    }
    return out;
  }, [data, active, today]);
  const max = Math.max(1, ...weeks.map((w) => w.done + w.planned));
  // Le graphique se lit en une phrase : la semaine la plus forte et la plus calme, ou « chaque semaine » si elles se valent.
  const parSemaine = weeks.map((w) => Math.round(w.done + w.planned));
  const pleines = parSemaine.filter((v) => v !== 0);
  const forte = weeks[parSemaine.indexOf(Math.max(...parSemaine))];
  // Le graphique ne se montre que si une semaine au moins a rapporté quelque chose.
  const phraseSemaines = !pleines.length
    ? ""
    : pleines.length === parSemaine.length && new Set(pleines).size === 1
      ? `Chaque semaine, tes séances rapportent ${eur(pleines[0])}.`
      : `La meilleure semaine, celle du ${forte.label}, rapporte ${eur(Math.max(...parSemaine))} ; la plus calme, ${eur(Math.min(...parSemaine))}.`;

  const mName = monthName(active.year, active.month);
  const lastDay = new Date(active.year, active.month, 0).getDate();
  const pct = objective > 0 ? Math.max(0, Math.min(100, (m.net / objective) * 100)) : 0;
  const restPct = objective > 0 ? Math.max(0, Math.min(100 - pct, (rest / objective) * 100)) : 0;
  // Une écurie neuve : le chiffre vient des tarifs, pas encore de clients. Une estimation, à l'encre.
  const estime = useMemo(() => estEstimation(data, active), [data, active]);
  // Le mois en cours se montre en une barre, du 1er au dernier jour, plutôt qu'en phrase.
  const mois = isNow ? barreDuMois(today) : null;

  // Le chiffre d'abord : pas de titre ni de phrase au-dessus, la gérante est dans la carte.
  const goal = (
    <div className="card ar-goal rise" style={{ animationDelay: ".1s" }}>
      <div className="ar-gtx">
        <p className="k">{estime ? "Si tout est payé, environ" : isNow ? `Ce mois, ${resteOuManque(m.net)}` : Math.round(m.net) < 0 ? `En ${mName}, il t’a manqué` : `En ${mName}, il t’est resté`}</p>
        <p className={`big ${estime ? "" : m.net > 0 ? "in" : m.net < 0 ? "out" : ""}`}>
          <CountUp value={m.net} fmt={estime ? undefined : (n) => eur(Math.abs(n))} />
        </p>
        {estime && <p className="note">Une estimation : tes chevaux n’ont pas encore de propriétaire.</p>}
        {isNow && Math.round(rest) !== 0 && (
          <p className="note">
            Encore {sg(rest)} prévus d’ici le {lastDay} ({PORTEE_PREVU}).
          </p>
        )}
      </div>
      <span className="ar-gill" aria-hidden="true">
        <Ill n="foin" className="ar-who" prio />
      </span>
      {mois && (
        <div className="ar-mois" role="img" aria-label={mois.aria}>
          <div className="ar-mtr">
            <i style={{ width: `${mois.pct}%` }} />
          </div>
          <div className="ar-mlab" aria-hidden="true">
            <span>{mois.debut}</span>
            <span className="ar-auj" style={{ left: `${Math.max(22, Math.min(78, mois.pct))}%` }}>
              aujourd’hui
            </span>
            <span>{mois.fin}</span>
          </div>
        </div>
      )}
      {objective > 0 && (
        <>
          <div className="bar" aria-hidden="true">
            {restPct > 0 && <i className="plan" style={{ width: `${pct + restPct}%` }} />}
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="bar-lab">
            <span>{m.net >= objective ? "objectif atteint" : `${Math.round(pct)} % de ton objectif`}</span>
            <span>objectif : {eur(objective)}</span>
          </div>
        </>
      )}
      {editGoal ? (
        <label className="field">
          <span>Ce que tu veux qu’il te reste par mois</span>
          <span className="input">
            <input inputMode="decimal" defaultValue={montantEnTexte(objective)} placeholder="0" onChange={(e) => setObjective(montantOuZero(e.target.value))} onBlur={() => setEditGoal(false)} autoFocus />
            <span className="u">€</span>
          </span>
          <small className="ar-goalh">Laisse vide si tu n’as pas d’objectif.</small>
        </label>
      ) : (
        <div className="ar-lnks">
          <button type="button" className="lnk" onClick={() => setEditGoal(true)}>
            {objective > 0 ? "Changer l’objectif" : "Te fixer un objectif"}
          </button>
          <Link className="lnk" href="/argent?vue=leviers">
            Voir les idées
          </Link>
        </div>
      )}
    </div>
  );

  const aria = `Séances de ${mName} par semaine : ${weeks.map((w) => `${eur(w.done + w.planned)}${w.planned ? ` dont ${eur(w.planned)} prévus` : ""}`).join(", ")}.`;

  const ceQuiRentre = (
        <Sec title={estime ? "Ce qui devrait rentrer" : "Ce qui rentre"} action={<span className={`act${!estime && Math.round(m.revenue) ? " in" : ""}`}>{sg(m.revenue)}</span>} delay={0.2}>
          {m.ins.length === 0 && <p className="note">Rien n’est encore rentré ce mois-ci.</p>}
                    {m.ins.map((x) => (
            <div key={x.label} className="ar-post">
              <span className="ar-pic">
                <Ic n={icFor(x.label)} className="ar-ic" />
              </span>
              <span>{x.label}</span>
              <Money v={x.amount} prevu={estime} />
            </div>
          ))}
        </Sec>
  );
  const ceQuiSort = (
        <Sec title="Ce qui sort" action={<span className={`act${!estime && Math.round(m.direct + m.sharedTotal + m.outside) ? " out" : ""}`}>{sg(-(m.direct + m.sharedTotal + m.outside))}</span>} delay={0.26}>
          {m.shared.map((x) => (
            <div key={x.label} className="ar-post">
              <span className="ar-pic">
                <Ic n={icFor(x.label)} className="ar-ic" />
              </span>
              <span>{libelleFrais(x.label)}</span>
              <Money v={-x.amount} prevu={estime} />
            </div>
          ))}
          <div className="ar-post">
            <span className="ar-pic">
              <Ic n="shoe" className="ar-ic" />
            </span>
            <span>
              Soins et frais des chevaux
              <small>maréchal, vétérinaire, compléments</small>
            </span>
            <Money v={-m.direct} prevu={estime} />
          </div>
          {m.outs.map((x) => (
            <div key={`hors-${x.label}`} className="ar-post">
              <span className="ar-pic">
                <Ic n={icFor(x.label)} className="ar-ic" />
              </span>
              <span>
                {x.label}
                <small>hors chevaux</small>
              </span>
              <Money v={-x.amount} prevu={estime} />
            </div>
          ))}
        </Sec>
  );

  return (
    <div className="ar-split">
      <div>
        {goal}
        {ceQuiRentre}
        {ceQuiSort}
      </div>

      <div>
        {phraseSemaines && (
        <Sec title="Tes séances, semaine par semaine" delay={0.32}>
          <p className="note">{phraseSemaines}</p>
          <div className="ar-wk" role="img" aria-label={aria} style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>
            {weeks.map((w, i) => (
              <div key={w.label}>
                <em>{Math.round(w.done + w.planned)}</em>
                <span className="ar-st">
                  {w.planned > 0 && <i className="p" style={{ height: `${(w.planned / max) * 100}%`, animationDelay: `${i * 0.08}s` }} />}
                  {w.done > 0 && <i className="d" style={{ height: `${(w.done / max) * 100}%`, borderRadius: w.planned ? 0 : undefined, animationDelay: `${i * 0.08}s` }} />}
                </span>
                <small className={w.now ? "now" : undefined}>{w.label}</small>
              </div>
            ))}
          </div>
          <div className="ar-leg">
            <span>
              <i />a eu lieu
            </span>
            <span>
              <i className="p" />
              encore prévu
            </span>
          </div>
          <p className="note">En euros. Sous chaque barre, le premier jour de la semaine.</p>
        </Sec>
        )}
        {isNow && <Piste delay={0.48} />}
        <nav className="card ar-links rise" style={{ animationDelay: ".48s" }} aria-label="Pour aller plus loin">
          {isNow && (
            <Link href="/chevaux?vue=clients" className="ar-lrow">
              <span className="ar-pic">
                <Ic n="people" className="ar-ic" />
              </span>
              <span>
                <span className="k">Qui te doit quoi</span>
                <b>{dues.length ? `${dues.length} client${dues.length > 1 ? "s" : ""} te ${dues.length > 1 ? "doivent" : "doit"} ${eur(duTotal)}. Tu les retrouves dans Clients.` : "Tout le monde t’a payé ce mois-ci."}</b>
              </span>
              <Ic n="chev" className="chev" />
            </Link>
          )}
          <Link href="/seuil" className="ar-lrow">
            <span className="ar-pic">
              <Ic n="flag" className="ar-ic" />
            </span>
            <span>
              <span className="k">Combien de chevaux pour ne pas perdre d’argent</span>
              <b>{!isFinite(m.seuil) ? "Tes pensions ne paient pas encore les soins des chevaux" : !places.atteignable ? memePlein(capacity, eur(places.manque)) : `${ilFautPensions(m.seuil)} Tu en as ${m.pensions}.`}</b>
            </span>
            <Ic n="chev" className="chev" />
          </Link>
          <Link href="/part" className="ar-lrow">
            <span className="ar-pic">
              <Ic n="hay" className="ar-ic" />
            </span>
            <span>
              <span className="k">Les frais de l’écurie</span>
              <b>
                Comment le foin et le loyer se partagent entre {m.horseCount > 1 ? `tes ${m.horseCount} chevaux` : "tes chevaux"}
              </b>
            </span>
            <Ic n="chev" className="chev" />
          </Link>
          <Link href="/pilotage" className="ar-lrow">
            <span className="ar-pic">
              <Ic n="chart" className="ar-ic" />
            </span>
            <span>
              <span className="k">Sur plusieurs mois</span>
              <b>Ton argent sur 3, 6 ou 12 mois</b>
            </span>
            <Ic n="chev" className="chev" />
          </Link>
        </nav>
      </div>
    </div>
  );
}

/** La meilleure piste du moment (faire payer ce qui est dû d'abord), qui mène à « Gagner plus ». */
function Piste({ delay }: { delay: number }) {
  const data = useDataStore();
  const capacity = useSettingsStore((s) => s.capacity);
  const list = useMemo(() => suggestions(data, currentPeriod(), capacity).filter((s) => s.status !== "faite" && s.status !== "ecartee"), [data, capacity]);
  const action = list.find((s) => s.lever === "facturer") ?? list[0];
  if (!action) return null;
  return (
    <Sec ill="piste" title="Une idée pour gagner plus" action={<Link href="/argent?vue=leviers">{list.length > 1 ? `Les ${list.length} idées` : "Voir"}</Link>} delay={delay}>
      <Link href="/argent?vue=leviers" className="ar-piste">
        <span style={{ minWidth: 0 }}>
          <b>{action.title}</b>
          <small>{cap(action.sub)}</small>
        </span>
        <span className="num">
          {sg(action.gain)}
          <small>{action.unit}</small>
        </span>
      </Link>
    </Sec>
  );
}

/* ---------------- Leviers ---------------- */
const LEVERS: { id: Lever; title: string; ill: IllName }[] = [
  { id: "remplir", title: "Remplir les places", ill: "tete-fondu" },
  { id: "facturer", title: "Te faire payer ce qu’on te doit", ill: "sacoche" },
  { id: "depenser", title: "Dépenser moins", ill: "foin" },
];
const STATUS: Record<Suggestion["status"], [string, string]> = {
  proposee: ["idée", "pill"],
  en_cours: ["en cours", "pill ar-ring"],
  faite: ["fait", "pill ink"],
  ecartee: ["mise de côté", "pill"],
};

function Leviers() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const capacity = useSettingsStore((s) => s.capacity);
  const objective = useSettingsStore((s) => s.objective);
  const st = useDataStore.getState;
  const say = useUiStore((s) => s.say);
  const list = useMemo(() => suggestions(data, active, capacity), [data, active, capacity]);
  const m = useMemo(() => monthBreakdown(data, active), [data, active]);
  const monthly = list.filter((s) => s.status !== "faite" && s.unit !== "une fois").reduce((t, s) => t + s.gain, 0);
  const gained = list.filter((s) => s.status === "faite").reduce((t, s) => t + (s.measured ?? s.gain), 0);

  function apply(s: Suggestion) {
    const snap = { revenues: st().revenues, directExpenses: st().directExpenses, horses: st().horses, actions: st().actions };
    const undo = () => useDataStore.setState(snap);
    if (s.apply.type === "rebill") {
      st().rebillExpense(s.apply.expenseId);
      say(`Ajouté à sa facture : <strong>+${eur(s.gain)}</strong>.`, undo);
    } else if (s.apply.type === "pension") {
      st().setPension(s.apply.horseId, s.apply.amount, localToday().slice(0, 7));
      st().setActionStatus(s.id, "faite");
      say(`Pension changée : <strong>+${eur(s.gain)}</strong> par mois à partir du 1er.`, undo);
    } else if (s.apply.type === "publish") {
      st().setActionStatus(s.id, "en_cours");
      say("Noté, tu t’en occupes. Tu peux annoncer ta place dans Ma fiche mon-ecurie.fr.", undo);
    } else {
      st().setActionStatus(s.id, "en_cours");
      say(`Noté, tu t’en occupes : <strong>${esc(s.title)}</strong>.`, undo);
    }
  }

  return (
    <>
      <div className="card ar-head rise" style={{ animationDelay: ".05s" }}>
        <Ill n="piste" />
        <p className="k">{phrasePistes(m.net, objective)}</p>
        <p className="big num">
          <CountUp value={monthly} />
        </p>
        <span className="ar-u">de plus par mois possibles (estimation)</span>
        {gained > 0 && (
          <p className="ar-gain">
            <span>Déjà gagné grâce à ce que tu as fait</span>
            <Money v={gained} />
          </p>
        )}
      </div>
      <div className="ar-lev3">
        {LEVERS.map((lv, k) => {
          const acts = list.filter((s) => s.lever === lv.id);
          return (
            <Sec
              key={lv.id}
              ill={lv.ill}
              className="ar-fam"
              delay={0.12 + k * 0.08}
              title={
                <>
                  {lv.title}
                  <small>{acts.length ? `${acts.length} piste${acts.length > 1 ? "s" : ""}` : "rien à faire ce mois-ci"}</small>
                </>
              }
              action={<span className="act">{sg(leverPotential(list, lv.id))} possibles</span>}
            >
              {acts.map((s) => (
                <div key={s.id} className={`ar-pst${s.status === "faite" ? " fait" : s.status === "ecartee" ? " cote" : ""}`}>
                  <span>
                    <b>{s.title}</b>
                    <p>{s.sub}</p>
                  </span>
                  <span className="ar-rt">
                    <span className={s.status === "faite" ? "in" : "num"}>
                      {sg(s.measured ?? s.gain)}
                      <small>{s.status === "faite" ? "gagnés" : s.unit}</small>
                    </span>
                    <span className={STATUS[s.status][1]}>{STATUS[s.status][0]}</span>
                  </span>
                  {s.status !== "faite" && (
                    <span className="ar-acts">
                      <button type="button" className="lnk" onClick={() => apply(s)}>
                        {s.apply.type === "rebill" ? "Ajouter à sa facture" : s.apply.type === "pension" ? "Changer la pension au 1er du mois" : s.status === "en_cours" ? "J’y travaille encore" : "Je m’en occupe"}
                      </button>
                      {s.status === "en_cours" && (
                        <button type="button" className="lnk" onClick={() => st().setActionStatus(s.id, "faite")}>
                          C’est fait
                        </button>
                      )}
                      <button type="button" className="lnk soft" onClick={() => st().setActionStatus(s.id, "ecartee")}>
                        Pas pour moi
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </Sec>
          );
        })}
      </div>
      <div className="pad rise" style={{ animationDelay: ".36s" }}>
        <p className="note">Ce sont des estimations, pas des promesses. Elles bougent dès que tu notes quelque chose.</p>
        <Link href="/scenarios" className="btn line full" style={{ marginTop: 12 }}>
          <Ic n="chart" className="" />
          Et si j’augmentais mes pensions ?
        </Link>
      </div>
    </>
  );
}

/* ---------------- Mouvements ---------------- */
const freqLabel = (f: string) => (f === "monthly" ? "chaque mois" : f === "quarterly" ? "tous les 3 mois" : "chaque année");
const shortDate = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const moisEnCours = () => new Date().toLocaleDateString("fr-FR", { month: "long" });
/**
 * Une récurrente arrêtée en cours de mois compte ce mois-là en entier (une
 * échéance par mois, pas au prorata des jours) : l'écran le dit.
 */
const finEnMots = (iso: string) => {
  const mois = new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { month: "long" });
  const dernier = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0).getDate() === Number(iso.slice(8, 10));
  return dernier ? `jusqu’à fin ${mois}` : `arrêtée le ${shortDate(iso)}, ${mois} compte en entier`;
};

function Mouvements() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const say = useUiStore((s) => s.say);
  const openNoter = useUiStore((s) => s.openNoter);
  const [kind, setKind] = useState<"tout" | "in" | "out">("tout");
  const desk = useDesk();
  const [horse, setHorse] = useState("");
  const name = (id: string) => data.horses.find((h) => h.id === id)?.name ?? "";
  const cat = (id?: string) => [...data.revenueCategories, ...data.expenseCategories].find((c) => c.id === id)?.name;
  const rows = useMemo(() => {
    const r = data.revenues
      .filter((x) => dateInPeriod(x.date, active))
      .map((x) => ({ id: x.id, t: "rev" as const, date: x.date, label: x.note || cat(x.categoryId) || "Rentrée d’argent", sub: [x.horseId ? name(x.horseId) : "hors chevaux", x.payer].filter(Boolean).join(" · "), amount: x.amount, horseId: x.horseId }));
    const d = data.directExpenses
      .filter((x) => dateInPeriod(x.date, active))
      .map((x) => ({ id: x.id, t: "dir" as const, date: x.date, label: x.label, sub: [x.horseId ? name(x.horseId) : "hors chevaux", x.rebillRevenueId ? "remis sur sa facture" : ""].filter(Boolean).join(" · "), amount: -x.amount, horseId: x.horseId }));
    const s = data.sharedExpenses
      .filter((x) => x.periodYear === active.year && x.periodMonth === active.month)
      .map((x) => ({ id: x.id, t: "sh" as const, date: `${active.year}-${String(active.month).padStart(2, "0")}-01`, label: libelleFrais(x.label), sub: partageLabel(repartition(data, x).length), amount: -x.totalAmount, horseId: "" }));
    return [...r, ...d, ...s]
      .filter((x) => (kind === "in" ? x.amount > 0 : kind === "out" ? x.amount < 0 : true))
      .filter((x) => !horse || x.horseId === horse)
      .sort((a, b) => b.date.localeCompare(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, active, kind, horse]);
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.date, [...(groups.get(r.date) ?? []), r]);

  // Les récurrentes arrêtées avant ce mois ne sont plus listées ; leur argent passé reste dans les mois.
  const debutMois = `${localToday().slice(0, 7)}-01`;
  const enCours = (r: { endDate?: string | null }) => !r.endDate || r.endDate >= debutMois;
  const arretee = (r: { endDate?: string | null }) => !!r.endDate && r.endDate <= localToday();
  const recRevs = (data.recurringRevenues ?? []).filter((r) => kind !== "out" && (!horse || r.horseId === horse) && enCours(r));
  const recExps = (data.recurringExpenses ?? []).filter((r) => kind !== "in" && (!horse || r.horseId === horse) && enCours(r));

  /** Une ligne déjà sur une facture ne se corrige ni ne se retire ici : la facture est figée, on fait un avoir. */
  const facturee = (l: LigneArgent) => {
    const n = factureDeLigne(useDataStore.getState(), l);
    if (n) say(esc(messageFacturee(n)));
    return !!n;
  };
  /** Toucher une ligne : la même feuille que le +, remplie, avec « Enregistrer ». */
  const corriger = (l: LigneArgent) => {
    if (!facturee(l)) openNoter({ edit: l });
  };

  function remove(r: (typeof rows)[number]) {
    if (facturee({ t: r.t, id: r.id })) return;
    const st = useDataStore.getState();
    const snap = { revenues: st.revenues, directExpenses: st.directExpenses, sharedExpenses: st.sharedExpenses, careEvents: st.careEvents };
    if (r.t === "rev") st.deleteRevenue(r.id);
    if (r.t === "dir") st.deleteDirectExpense(r.id);
    if (r.t === "sh") st.deleteSharedExpense(r.id);
    say(`Supprimé : ${esc(r.label)}.`, () => useDataStore.setState(snap));
  }

  return (
    <>
      <div className="ar-filt">
        <Chips
          value={kind}
          onChange={setKind}
          options={[
            ["tout", "Tout"],
            ["in", "Ce qui rentre"],
            ["out", "Ce qui sort"],
          ]}
        />
        <span className="ar-selw">
          <select className={`chip ar-horsesel${horse ? " on" : ""}`} value={horse} onChange={(e) => setHorse(e.target.value)} aria-label="Filtrer par cheval">
            <option value="">Tous les chevaux</option>
            {data.horses
              .filter((h) => !h.isArchived)
              .map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
          </select>
          <Ic n="chev" className="ar-ic" />
        </span>
      </div>
      {rows.length === 0 && <Empty>Rien de noté ici pour l’instant. Ce que tu ajoutes avec le + arrive ici.</Empty>}
      {desk && rows.length > 0 && (
        <div className="ar-tbl-wrap rise" style={{ animationDelay: ".05s" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Quoi</th>
                <th>Détail</th>
                <th className="n">Montant</th>
                <th style={{ width: 44 }}>
                  <span className="ar-sr">Supprimer</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="m" style={{ whiteSpace: "nowrap" }}>
                    {new Date(r.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                  </td>
                  <td>
                    <button type="button" className="ar-what ar-fix" onClick={() => corriger({ t: r.t, id: r.id })} aria-label={`Corriger : ${r.label}`}>
                      <Ic n={icFor(r.label)} className="ar-ic" />
                      {r.label}
                    </button>
                  </td>
                  <td className="m">{r.sub}</td>
                  <td className="n">
                    <Money v={r.amount} />
                  </td>
                  <td>
                    <button type="button" className="ar-bin" aria-label={`Supprimer : ${r.label}`} title="Supprimer (tu as 6 secondes pour annuler)" onClick={() => remove(r)}>
                      <Ic n="trash" className="ar-ic" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>
                  {rows.length} ligne{rows.length > 1 ? "s" : ""}
                </td>
                <td className="n">
                  <Money v={rows.reduce((t, r) => t + r.amount, 0)} />
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {!desk && rows.length > 0 && (
        <div className="rise" style={{ animationDelay: ".05s" }}>
          {[...groups.entries()].map(([d, rs]) => (
            <div key={d}>
              <div className="ar-day">{new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</div>
              {rs.map((r) => (
                <div key={r.id} className="ar-mv">
                  <span className="ar-pic">
                    <Ic n={icFor(r.label)} className="ar-ic" />
                  </span>
                  <button type="button" className="ar-fix" onClick={() => corriger({ t: r.t, id: r.id })} aria-label={`Corriger : ${r.label}`}>
                    <b>{r.label}</b>
                    {r.sub && <small>{r.sub}</small>}
                  </button>
                  <Money v={r.amount} />
                  <button type="button" className="ar-bin" aria-label={`Supprimer : ${r.label}`} onClick={() => remove(r)}>
                    <Ic n="trash" className="ar-ic" />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {(recRevs.length > 0 || recExps.length > 0) && (
        <Sec
          blk
          ill="gerant-assise"
          delay={0.15}
          title="Compté chaque mois"
          action={<button type="button" className="act" onClick={() => openNoter({ kind: "depense" })}>+ Ajouter</button>}
        >
          {recRevs.map((r) => (
            <div key={r.id} className="ar-rec">
              <span className="ar-pic">
                <Ic n="clock" className="ar-ic" />
              </span>
              <button type="button" className="ar-fix" onClick={() => corriger({ t: "recrev", id: r.id })} aria-label={`Corriger : ${r.label ?? "Pension"}`}>
                <b>
                  {r.label ?? "Pension"} · {name(r.horseId) || "cheval retiré"}
                </b>
                <small>
                  rentre {freqLabel(r.frequency)}
                  {r.endDate ? ` · ${finEnMots(r.endDate)}` : " · sans date de fin"}
                </small>
              </button>
              <span className="ar-rt">
                <Money v={r.amount} />
                {!arretee(r) && (
                  <button
                    type="button"
                    className="lnk"
                    aria-label={`Arrêter ${r.label ?? "la pension"}`}
                    onClick={() => confirm(`Arrêter cette rentrée d’argent qui revient chaque mois ? ${cap(moisEnCours())} compte en entier. À partir du mois prochain, elle ne rapportera plus rien. Ce qu’elle a déjà rapporté reste dans les mois passés.`) && useDataStore.getState().stopRecurringRevenue(r.id)}
                  >
                    Arrêter
                  </button>
                )}
              </span>
            </div>
          ))}
          {recExps.map((r) => (
            <div key={r.id} className="ar-rec">
              <span className="ar-pic">
                <Ic n="clock" className="ar-ic" />
              </span>
              <button type="button" className="ar-fix" onClick={() => corriger({ t: "recexp", id: r.id })} aria-label={`Corriger : ${r.label}`}>
                <b>{r.label}</b>
                <small>
                  {freqLabel(r.frequency)} · {r.isShared ? "frais de l’écurie" : `pour ${name(r.horseId ?? "") || "1 cheval"}`}
                  {r.endDate ? ` · ${finEnMots(r.endDate)}` : ""}
                </small>
              </button>
              <span className="ar-rt">
                <Money v={-r.amount} />
                {!arretee(r) && (
                  <button
                    type="button"
                    className="lnk"
                    aria-label={`Arrêter ${r.label}`}
                    onClick={() => confirm(`Arrêter « ${r.label} » ? ${cap(moisEnCours())} compte en entier, même si tu arrêtes en cours de mois. À partir du mois prochain, plus rien ne sera ajouté. Les mois passés ne changent pas.`) && useDataStore.getState().stopRecurringExpense(r.id)}
                  >
                    Arrêter
                  </button>
                )}
              </span>
            </div>
          ))}
        </Sec>
      )}
      <Link href="/facturation#comptable" className="card ar-lcard rise" style={{ animationDelay: ".2s", marginTop: 18 }}>
        <span className="ar-pic">
          <Ic n="download" className="ar-ic" />
        </span>
        <span>
          <span className="k">Pour ton comptable</span>
          <b>Le tableau de l’année, à télécharger pour Excel</b>
        </span>
        <Ic n="chev" className="chev" />
      </Link>
    </>
  );
}
