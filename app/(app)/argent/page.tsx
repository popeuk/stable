"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { cap, dec1, esc } from "@/components/bs/ui";
import { plannedRest } from "@/components/bs/goal-card";
import { Compteur } from "@/components/bs/compteur";
import { hasObjective, phraseObjectifMois, phrasePistes } from "@/lib/domain/objectif";
import { partageLabel, repartition } from "@/lib/domain/presence";
import { useDesk } from "@/components/bs/desk";
import { Chips, Coins, CountUp, Empty, Hello, Ic, Ill, Money, Page, Sec, Seg, eur, ini, sg, type IllName } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { usePeriodStore } from "@/stores/period-store";
import { useUiStore } from "@/stores/ui-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { suggestions, leverPotential, type Lever, type Suggestion } from "@/lib/domain/leviers";
import { billTotals, billsFor, monthKey, type Bill } from "@/lib/domain/billing";
import { seanceAmount } from "@/lib/domain/seances";
import { currentPeriod, dateInPeriod, samePeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";
import { addDays, weekdayIndex } from "@/components/bs/dates";
import { montantEnTexte, montantOuZero } from "@/lib/utils/montant";

/**
 * Mon mois (ancien Bilan) : le compteur du mois en tête, d'où vient l'argent et
 * où il part, une piste pour gagner plus, puis les leviers (remplir, facturer
 * juste, dépenser mieux), ce qu'il faut facturer par personne, et tous les
 * mouvements à corriger. Rendu : le carnet illustré.
 */
type Vue = "mois" | "leviers" | "facturer" | "mouvements";
const VUES: [Vue, string][] = [
  ["mois", "Le mois"],
  ["leviers", "Gagner plus"],
  ["facturer", "Facturer"],
  ["mouvements", "Historique"],
];
const TITRES: Record<Vue, string> = { mois: "Mon mois", leviers: "Pistes pour gagner plus", facturer: "À facturer", mouvements: "Entrées et sorties d’argent" };

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
/** « d’octobre », « de mai ». */
const deMois = (name: string) => (/^[aeiouyéè]/i.test(name) ? `d’${name}` : `de ${name}`);

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
        <Seg value={vue} onChange={(v) => router.replace(v === "mois" ? "/argent" : `/argent?vue=${v}`)} options={VUES} label="Vues de Mon mois" />
      </div>
      {vue === "mois" && <Mois />}
      {vue === "leviers" && <Leviers />}
      {vue === "facturer" && <Facturer />}
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
  const [editGoal, setEditGoal] = useState(false);
  const m = useMemo(() => monthBreakdown(data, active), [data, active]);
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

  const now = new Date();
  const mName = monthName(active.year, active.month);
  const lastDay = new Date(active.year, active.month, 0).getDate();
  const daysLeft = lastDay - now.getDate();
  const pct = objective > 0 ? Math.max(0, Math.min(100, (m.net / objective) * 100)) : 0;
  const restPct = objective > 0 ? Math.max(0, Math.min(100 - pct, (rest / objective) * 100)) : 0;
  const gagne = m.net > 0;

  const titre = isNow ? (
    gagne ? (
      <>
        Oui. Ce mois,
        <br />
        tu gagnes ta vie.
      </>
    ) : (
      <>
        Pas encore. Ce mois,
        <br />
        l’écurie te coûte.
      </>
    )
  ) : gagne ? (
    <>
      Oui. En {mName},
      <br />
      tu as gagné ta vie.
    </>
  ) : (
    <>
      Non. En {mName},
      <br />
      l’écurie t’a coûté.
    </>
  );

  const sub = isNow ? (
    <>
      Au {now.getDate()} {mName}, tout payé, il te reste <Money v={m.net} />.{" "}
      {phraseObjectifMois(m.net, objective, true)}
    </>
  ) : (
    <>
      Tout payé, il t’est resté <Money v={m.net} />. {phraseObjectifMois(m.net, objective, false)}
    </>
  );

  const goal = (
    <div className="card ar-goal rise" style={{ animationDelay: ".18s" }}>
      <p className="k">{isNow ? "Ce mois, il te reste" : `En ${mName}, il t’est resté`}</p>
      <p className={`big ${m.net > 0 ? "in" : m.net < 0 ? "out" : ""}`}>
        <CountUp value={m.net} />
      </p>
      {isNow && (
        <p className="note">
          {Math.round(rest) !== 0 && (
            <>
              Encore <Money v={rest} /> prévus au planning d’ici le {lastDay}.{" "}
            </>
          )}
          Il reste {daysLeft} jour{daysLeft > 1 ? "s" : ""}.
        </p>
      )}
      <div className="bar" aria-hidden="true">
        {restPct > 0 && <i className="plan" style={{ width: `${pct + restPct}%` }} />}
        <i style={{ width: `${pct}%` }} />
      </div>
      {hasObjective(objective) && (
        <div className="bar-lab">
          <span>{m.net >= objective ? "objectif atteint" : `${Math.round(pct)} % du chemin`}</span>
          <span>objectif : {eur(objective)}</span>
        </div>
      )}
      {editGoal ? (
        <label className="field">
          <span>Ce que tu veux qu’il te reste par mois</span>
          <span className="input">
            <input inputMode="decimal" defaultValue={montantEnTexte(objective)} onChange={(e) => setObjective(montantOuZero(e.target.value))} onBlur={() => setEditGoal(false)} autoFocus />
            <span className="u">€</span>
          </span>
        </label>
      ) : (
        <div className="ar-lnks">
          <button type="button" className="lnk" onClick={() => setEditGoal(true)}>
            Changer l’objectif
          </button>
          <Link className="lnk" href="/argent?vue=leviers">
            Voir les pistes
          </Link>
        </div>
      )}
    </div>
  );

  const aria = `Séances de ${mName} par semaine : ${weeks.map((w) => `${eur(w.done + w.planned)}${w.planned ? ` dont ${eur(w.planned)} prévus` : ""}`).join(", ")}.`;

  const objectif = editGoal ? (
    <label className="field ar-goalf">
      <span>Ce que tu veux qu’il te reste par mois</span>
      <span className="input">
        <input inputMode="decimal" defaultValue={montantEnTexte(objective)} onChange={(e) => setObjective(montantOuZero(e.target.value))} onBlur={() => setEditGoal(false)} autoFocus />
        <span className="u">€</span>
      </span>
    </label>
  ) : (
    <div className="ar-lnks ar-cptl">
      <button type="button" className="lnk" onClick={() => setEditGoal(true)}>
        Changer l’objectif
      </button>
      {Math.round(rest) !== 0 && (
        <span>
          Encore <Money v={rest} /> prévus au planning, {daysLeft} jour{daysLeft > 1 ? "s" : ""} restant{daysLeft > 1 ? "s" : ""}.
        </span>
      )}
    </div>
  );

  return (
    <div className="ar-split">
      <div>
        {isNow ? (
          <>
            <div className="ar-cpt">
              <Compteur />
            </div>
            {objectif}
          </>
        ) : (
          <>
            <div className="ar-compte" aria-hidden="true">
              <Ill n="foin" className="ar-who" />
              {gagne && <Coins />}
              <Ill n="sacoche" className="ar-sac" />
            </div>
            <Hello title={titre} sub={sub} delay={0.1} />
            {goal}
          </>
        )}
        <Sec ill="gerant-buste" title="Tes séances, semaine par semaine" delay={0.26}>
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
      </div>

      <div>
        <Sec ill="piste" title="Ce qui rentre" action={<span className="act in">{sg(m.revenue)}</span>} delay={0.34}>
          {m.ins.length === 0 && <p className="note">Rien n’est encore rentré ce mois-ci.</p>}
          {m.ins.map((x) => (
            <div key={x.label} className="ar-post">
              <span className="ar-pic">
                <Ic n={icFor(x.label)} className="ar-ic" />
              </span>
              <span>{x.label}</span>
              <Money v={x.amount} />
            </div>
          ))}
        </Sec>
        <Sec ill="gerant-foin" title="Ce qui sort" action={<span className="act out">{sg(-(m.direct + m.sharedTotal + m.outside))}</span>} delay={0.42}>
          {m.shared.map((x) => (
            <div key={x.label} className="ar-post">
              <span className="ar-pic">
                <Ic n={icFor(x.label)} className="ar-ic" />
              </span>
              <span>{x.label}</span>
              <Money v={-x.amount} />
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
            <Money v={-m.direct} />
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
              <Money v={-x.amount} />
            </div>
          ))}
        </Sec>
        {isNow && <Piste delay={0.48} />}
        <Link href="/seuil" className="card ar-lcard rise" style={{ animationDelay: ".5s", marginTop: 18 }}>
          <span className="ar-pic">
            <Ic n="flag" className="ar-ic" />
          </span>
          <span>
            <span className="k">Combien de chevaux pour ne pas perdre d’argent</span>
            <b>{isFinite(m.seuil) ? `Il en faut ${dec1(m.seuil)}. Tu en as ${m.horseCount}.` : "Tes pensions ne paient pas encore les soins des chevaux"}</b>
          </span>
          <Ic n="chev" className="chev" />
        </Link>
        <Link href="/part" className="card ar-lcard rise" style={{ animationDelay: ".56s" }}>
          <span className="ar-pic">
            <Ic n="hay" className="ar-ic" />
          </span>
          <span>
            <span className="k">Le pot commun</span>
            <b>
              Comment le foin et le loyer se partagent entre {m.horseCount > 1 ? `tes ${m.horseCount} chevaux` : "tes chevaux"}
            </b>
          </span>
          <Ic n="chev" className="chev" />
        </Link>
        <Link href="/pilotage" className="card ar-lcard rise" style={{ animationDelay: ".62s" }}>
          <span className="ar-pic">
            <Ic n="chart" className="ar-ic" />
          </span>
          <span>
            <span className="k">Sur plusieurs mois</span>
            <b>Ton bilan sur 3, 6 ou 12 mois</b>
          </span>
          <Ic n="chev" className="chev" />
        </Link>
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
    <Sec blk ill="piste" title="Une piste pour gagner plus" action={<Link href="/argent?vue=leviers">{list.length > 1 ? `Les ${list.length} pistes` : "Voir"}</Link>} delay={delay}>
      <Link href="/argent?vue=leviers" className="ar-piste">
        <span style={{ minWidth: 0 }}>
          <b>{action.title}</b>
          <small>{cap(action.sub)}</small>
        </span>
        <span className="in">
          {sg(action.gain)}
          <small>{action.unit}</small>
        </span>
      </Link>
    </Sec>
  );
}

/* ---------------- Leviers ---------------- */
const LEVERS: { id: Lever; title: string; ill: IllName }[] = [
  { id: "remplir", title: "Remplir les boxes", ill: "tete-fondu" },
  { id: "facturer", title: "Faire payer ce qui est dû", ill: "sacoche" },
  { id: "depenser", title: "Payer moins cher", ill: "foin" },
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
      say("Noté, tu t’en occupes. La mise en ligne sur mon-ecurie.fr depuis l’app arrive bientôt.", undo);
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
        <p className="big in">
          <CountUp value={monthly} />
        </p>
        <span className="ar-u">de plus par mois (estimation)</span>
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
              action={<span className="act in">{sg(leverPotential(list, lv.id))}</span>}
            >
              {acts.map((s) => (
                <div key={s.id} className={`ar-pst${s.status === "faite" ? " fait" : s.status === "ecartee" ? " cote" : ""}`}>
                  <span>
                    <b>{s.title}</b>
                    <p>{s.sub}</p>
                  </span>
                  <span className="ar-rt">
                    <span className="in">
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
        <p className="note">Ces montants bougent dès que tu notes quelque chose. Ce sont des estimations, pas des promesses.</p>
        <Link href="/scenarios" className="btn line full" style={{ marginTop: 12 }}>
          <Ic n="chart" className="" />
          Et si j’augmentais mes pensions ?
        </Link>
      </div>
    </>
  );
}

/* ---------------- À facturer ---------------- */
function Facturer() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const say = useUiStore((s) => s.say);
  const [role, setRole] = useState<"proprietaire" | "cavalier">("proprietaire");
  const [open, setOpen] = useState<string | null>(null);
  const bills = useMemo(() => billsFor(data, active), [data, active]);
  const mk = monthKey(active);
  // Les mêmes chiffres que Clients : ce qui reste dû, client par client. Les
  // chevaux sans propriétaire sont dits à part, jamais comptés comme à recevoir.
  const { total, paid, sansProprietaire } = billTotals(bills);
  const orphan = bills.find((b) => b.orphan);
  const shown = bills.filter((b) => b.role === role && !b.orphan);
  const nProp = bills.filter((b) => b.role === "proprietaire" && !b.orphan).length;
  const nCav = bills.filter((b) => b.role === "cavalier").length;
  const desk = useDesk();
  const current = shown.find((b) => b.payer === open) ?? shown[0];
  const mName = monthName(active.year, active.month);

  function received(b: Bill) {
    const snap = useDataStore.getState().payments;
    useDataStore.getState().addPayment(b.payer, mk, b.due);
    say(`${esc(b.payer)} : <strong>${eur(b.due)}</strong> reçus.`, () => useDataStore.setState({ payments: snap }));
  }

  const billTicket = (b: Bill) => (
    <div className="ticket print" key={b.payer}>
      {desk && (
        <div className="ar-th">
          <span className="ini">{ini(b.payer)}</span>
          <span>{b.payer}</span>
          <span className="pill">{b.due <= 0 ? "payé" : `${eur(b.due)} dus`}</span>
        </div>
      )}
      {b.lines.map((l, i) => (
        <div key={i} className="r">
          <span>
            {l.label}
            <small>
              {l.horse ? `${l.horse} · ` : ""}
              {new Date(l.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </small>
          </span>
          <span>{eur(l.amount)}</span>
        </div>
      ))}
      <div className="r tot">
        <span>Total</span>
        <span>{eur(b.total)}</span>
      </div>
    </div>
  );

  function copy() {
    const txt = shown
      .map((b) => `${b.payer} : ${eur(b.total)}${b.paid ? ` (payé ${eur(b.paid)})` : ""}\n${b.lines.map((l) => `  · ${l.label}${l.horse ? ` (${l.horse})` : ""} ${eur(l.amount)}`).join("\n")}`)
      .join("\n\n");
    navigator.clipboard?.writeText(txt).then(
      () => say("Récapitulatif copié. Colle-le dans un e-mail ou dans ton logiciel de factures."),
      () => say("La copie ne marche pas sur ce navigateur."),
    );
  }

  return (
    <div className={desk ? "ar-split" : undefined}>
      <div>
        <div className="trio ar-sum3 rise" style={{ animationDelay: ".05s" }}>
          <div>
            <b>
              <CountUp value={total} fmt={eur} />
            </b>
            <small>à facturer</small>
          </div>
          <div>
            <b className="in">
              <CountUp value={paid} />
            </b>
            <small>déjà reçu</small>
          </div>
          <div>
            <b>
              <CountUp value={total - paid} fmt={eur} />
            </b>
            <small>encore à recevoir</small>
          </div>
        </div>
        <div className="ar-bseg" style={{ marginTop: 14 }}>
          <Seg
            value={role}
            onChange={setRole}
            label="Qui facturer"
            options={[
              ["proprietaire", `Propriétaires · ${nProp}`],
              ["cavalier", `Cavaliers · ${nCav}`],
            ]}
          />
        </div>
        <Sec ill="carnet-buste" title="Qui te doit quoi" action={<span className="act">{mName}</span>} delay={0.12}>
          {shown.length === 0 && !(role === "proprietaire" && orphan) && <p className="note">Personne à facturer ce mois-ci. Les pensions, séances et soins à refacturer apparaîtront ici.</p>}
          {role === "proprietaire" && orphan && (
            <p className="note">
              {(() => {
                const noms = [...new Set(orphan.lines.map((l) => l.horse).filter(Boolean))];
                const qui = noms.length > 3 ? `${noms.length} chevaux sans propriétaire` : `chevaux sans propriétaire (${noms.join(", ")})`;
                return `${eur(sansProprietaire)} viennent de ${qui}. Personne à qui les demander pour l’instant : ajoute leur propriétaire sur leur fiche.`;
              })()}
            </p>
          )}
          {shown.map((b) => {
            const isOpen = !desk && open === b.payer;
            const isCur = desk && current?.payer === b.payer;
            return (
              <div key={b.payer} className={`ar-payer${isOpen ? " open" : ""}${isCur ? " on" : ""}`}>
                <div className="ar-prow">
                  <button
                    type="button"
                    className="ar-whob"
                    onClick={() => setOpen(desk ? b.payer : open === b.payer ? null : b.payer)}
                    aria-expanded={desk ? undefined : open === b.payer}
                    aria-pressed={desk ? isCur : undefined}
                  >
                    <span className="ini">{ini(b.payer)}</span>
                    <span style={{ minWidth: 0 }}>
                      <b className="ar-nm">{b.payer}</b>
                      <small>
                        {b.lines.length} ligne{b.lines.length > 1 ? "s" : ""}
                        {(() => {
                          const hs = [...new Set(b.lines.map((l) => l.horse).filter(Boolean))].join(", ");
                          return hs ? ` · ${hs}` : "";
                        })()}
                      </small>
                    </span>
                  </button>
                  <span className="ar-rt">
                    <b>{eur(b.due > 0 ? b.due : b.total)}</b>
                    {b.due <= 0 ? (
                      <button
                        type="button"
                        className="pill"
                        aria-label={`${b.payer} : payé. Toucher pour annuler le paiement`}
                        onClick={() => {
                          useDataStore.getState().removePayments(b.payer, mk);
                          say(`${esc(b.payer)} : paiement annulé.`);
                        }}
                      >
                        payé
                      </button>
                    ) : (
                      <small>{b.due < b.total ? `à recevoir sur ${eur(b.total)}` : "à recevoir"}</small>
                    )}
                  </span>
                </div>
                {b.due > 0 && !desk && (
                  <div className="ar-pay">
                    <button type="button" className="btn line" onClick={() => received(b)}>
                      J’ai reçu le paiement
                    </button>
                  </div>
                )}
                {isOpen && billTicket(b)}
              </div>
            );
          })}
        </Sec>
        {shown.length > 0 && (
          <div className="pad rise" style={{ animationDelay: ".2s", marginTop: 14 }}>
            <button type="button" className="btn full" onClick={copy}>
              <Ic n="doc" className="" />
              Copier le récapitulatif {deMois(mName)}
            </button>
            <p className="note">Colle-le dans un mail ou dans ton logiciel de factures.</p>
          </div>
        )}
      </div>
      {desk && current && (
        <div className="ar-side">
          {billTicket(current)}
          {current.due > 0 && (
            <button type="button" className="btn full" style={{ marginTop: 14 }} onClick={() => received(current)}>
              {current.payer} a payé {eur(current.due)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Mouvements ---------------- */
const freqLabel = (f: string) => (f === "monthly" ? "chaque mois" : f === "quarterly" ? "tous les 3 mois" : "chaque année");
const shortDate = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

function Mouvements() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const say = useUiStore((s) => s.say);
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
      .map((x) => ({ id: x.id, t: "sh" as const, date: `${active.year}-${String(active.month).padStart(2, "0")}-01`, label: x.label, sub: partageLabel(repartition(data, x).length), amount: -x.totalAmount, horseId: "" }));
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

  function remove(r: (typeof rows)[number]) {
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
      {rows.length === 0 && <Empty>Rien de noté ici pour l’instant. Ce que tu ajoutes avec le bouton + apparaîtra dans cette liste.</Empty>}
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
                    <span className="ar-what">
                      <Ic n={icFor(r.label)} className="ar-ic" />
                      {r.label}
                    </span>
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
                  <span style={{ minWidth: 0 }}>
                    <b>{r.label}</b>
                    {r.sub && <small>{r.sub}</small>}
                  </span>
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
          title="Compté tout seul, chaque mois"
          action={<Link href="/saisie">+ Ajouter</Link>}
        >
          {recRevs.map((r) => (
            <div key={r.id} className="ar-rec">
              <span className="ar-pic">
                <Ic n="clock" className="ar-ic" />
              </span>
              <span style={{ minWidth: 0 }}>
                <b>
                  {r.label ?? "Pension"} · {name(r.horseId) || "cheval retiré"}
                </b>
                <small>
                  rentre {freqLabel(r.frequency)}
                  {r.endDate ? ` · jusqu’au ${shortDate(r.endDate)}` : " · sans date de fin"}
                </small>
              </span>
              <span className="ar-rt">
                <Money v={r.amount} />
                {!arretee(r) && (
                  <button
                    type="button"
                    className="lnk"
                    aria-label={`Arrêter ${r.label ?? "la pension"}`}
                    onClick={() => confirm("Arrêter cette rentrée d’argent qui revient chaque mois ? Ce qu’elle a déjà rapporté reste dans les mois passés.") && useDataStore.getState().stopRecurringRevenue(r.id)}
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
              <span style={{ minWidth: 0 }}>
                <b>{r.label}</b>
                <small>
                  {freqLabel(r.frequency)} · {r.isShared ? "pot commun" : `pour ${name(r.horseId ?? "") || "1 cheval"}`}
                  {r.endDate ? ` · jusqu’au ${shortDate(r.endDate)}` : ""}
                </small>
              </span>
              <span className="ar-rt">
                <Money v={-r.amount} />
                {!arretee(r) && (
                  <button
                    type="button"
                    className="lnk"
                    aria-label={`Arrêter ${r.label}`}
                    onClick={() => confirm(`Arrêter « ${r.label} » ? Elle ne sera plus comptée les mois suivants. Les mois passés ne bougent pas.`) && useDataStore.getState().stopRecurringExpense(r.id)}
                  >
                    Arrêter
                  </button>
                )}
              </span>
            </div>
          ))}
        </Sec>
      )}
    </>
  );
}
