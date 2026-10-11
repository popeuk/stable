"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, Sec, cap, dec1, eur, esc, signed } from "@/components/bs/ui";
import { Picto, pictoForLabel } from "@/components/bs/picto";
import { GoalCard } from "@/components/bs/goal-card";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { usePeriodStore } from "@/stores/period-store";
import { useUiStore } from "@/stores/ui-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { suggestions, leverPotential, type Lever, type Suggestion } from "@/lib/domain/leviers";
import { billsFor, monthKey } from "@/lib/domain/billing";
import { seanceAmount } from "@/lib/domain/seances";
import { currentPeriod, dateInPeriod, samePeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";
import { addDays, weekdayIndex } from "@/components/bs/dates";

/**
 * Argent : le mois face à l'objectif, les leviers (remplir, facturer
 * juste, dépenser mieux), ce qu'il faut facturer par personne, et tous les
 * mouvements à corriger.
 */
type Vue = "mois" | "leviers" | "facturer" | "mouvements";
const VUES: [Vue, string][] = [
  ["mois", "Mois"],
  ["leviers", "Leviers"],
  ["facturer", "Facturer"],
  ["mouvements", "Mouvements"],
];

export default function Page() {
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
  const vue = (useSearchParams().get("vue") as Vue) || "mois";
  const active = usePeriodStore((s) => s.active);
  const step = usePeriodStore((s) => s.step);
  const isNow = samePeriod(active, currentPeriod());
  const label = cap(new Date(active.year, active.month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: isNow ? undefined : "numeric" }));
  return (
    <Screen>
      <div className="bs-over">
        <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button type="button" className="bs-back" style={{ margin: 0, minHeight: 28 }} onClick={() => step(-1)} aria-label="Mois précédent">
            <Picto name="chevL" />
          </button>
          {label}
          {!isNow && (
            <button type="button" className="bs-back" style={{ margin: 0, minHeight: 28 }} onClick={() => step(1)} aria-label="Mois suivant">
              <Picto name="chev" />
            </button>
          )}
        </span>
      </div>
      <h1 className="bs-d bs-t1">{{ mois: "Le mois", leviers: "Les leviers", facturer: "À facturer", mouvements: "Mouvements" }[vue]}</h1>
      <div className="bs-seg" style={{ fontSize: 13 }}>
        {VUES.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={vue === v} onClick={() => router.replace(v === "mois" ? "/argent" : `/argent?vue=${v}`)}>
            {l}
          </button>
        ))}
      </div>
      {vue === "mois" && <Mois />}
      {vue === "leviers" && <Leviers />}
      {vue === "facturer" && <Facturer />}
      {vue === "mouvements" && <Mouvements />}
    </Screen>
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

  // Semaine par semaine : séances et soins du mois, prévus hachurés.
  const weeks = useMemo(() => {
    const first = `${active.year}-${String(active.month).padStart(2, "0")}-01`;
    let w = addDays(first, -weekdayIndex(first));
    const out: { label: string; done: number; planned: number }[] = [];
    while (w.slice(0, 7) <= first.slice(0, 7)) {
      const days = new Set(Array.from({ length: 7 }, (_, i) => addDays(w, i)).filter((d) => dateInPeriod(d, active)));
      if (days.size) {
        const ss = (data.seances ?? []).filter((s) => days.has(s.date) && s.status !== "cancelled");
        const done = ss.filter((s) => s.status === "done").reduce((t, s) => t + seanceAmount(s), 0);
        const planned = ss.filter((s) => s.status === "planned").reduce((t, s) => t + seanceAmount(s), 0);
        out.push({ label: `${Number([...days][0].slice(8))}`, done, planned });
      }
      w = addDays(w, 7);
    }
    return out;
  }, [data, active]);
  const max = Math.max(1, ...weeks.map((w) => w.done + w.planned));

  return (
    <>
      {isNow ? (
        <GoalCard href="/argent?vue=leviers" />
      ) : (
        <div className="bs-card">
          <span className="bs-pic soft">
            <Picto name="euro" />
          </span>
          <div style={{ flex: 1 }}>
            <div className="k">Résultat du mois</div>
            <div className={`bs-big${m.net < 0 ? " neg" : ""}`}>{signed(m.net)}</div>
          </div>
          <span className={`bs-pill ${m.net >= objective ? "g" : "n"}`}>{m.net >= objective ? "objectif tenu" : `objectif ${eur(objective)}`}</span>
        </div>
      )}
      {editGoal ? (
        <label className="bs-field">
          <span>Objectif par mois</span>
          <input inputMode="numeric" defaultValue={objective} style={{ textAlign: "right", fontWeight: 600 }} onChange={(e) => setObjective(Number(e.target.value) || 0)} onBlur={() => setEditGoal(false)} autoFocus />
          <span>€</span>
        </label>
      ) : (
        <button type="button" className="bs-link" style={{ marginTop: 8 }} onClick={() => setEditGoal(true)}>
          Changer l’objectif
        </button>
      )}

      <Sec>Séances, semaine par semaine</Sec>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${weeks.length},1fr)`, gap: 8, alignItems: "end", height: 90, marginTop: 6 }}>
        {weeks.map((w) => (
          <div key={w.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 3 }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--ink-2)" }}>{Math.round(w.done + w.planned)}</span>
            <div style={{ width: "64%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "70%" }}>
              {w.planned > 0 && <i style={{ display: "block", height: `${(w.planned / max) * 100}%`, background: "repeating-linear-gradient(135deg,var(--vert-soft) 0 4px,#fff 4px 7px)", boxShadow: "inset 0 0 0 1px var(--on-vert)", borderRadius: "2px 2px 0 0" }} />}
              {w.done > 0 && <i style={{ display: "block", height: `${(w.done / max) * 100}%`, background: "var(--vert)", borderRadius: w.planned ? 0 : "2px 2px 0 0" }} />}
            </div>
            <span style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{w.label}</span>
          </div>
        ))}
      </div>
      <p className="bs-p" style={{ fontSize: 12 }}>Plein : validé. Hachuré : encore prévu au planning. Sous chaque barre, le premier jour de la semaine.</p>

      <Sec>Ce qui rentre · {eur(m.revenue)}</Sec>
      {m.ins.map((x) => (
        <div key={x.label} className="bs-li">
          <span className="bs-pic">
            <Picto name={pictoForLabel(x.label)} />
          </span>
          <span className="tx">
            <b>{x.label}</b>
          </span>
          <span className="bs-amt plus">{signed(x.amount)}</span>
        </div>
      ))}
      <Sec>Ce qui sort · {eur(m.direct + m.sharedTotal)}</Sec>
      {m.shared.map((x) => (
        <div key={x.label} className="bs-li">
          <span className="bs-pic rose">
            <Picto name={pictoForLabel(x.label)} />
          </span>
          <span className="tx">
            <b>{x.label}</b>
          </span>
          <span className="bs-amt">{signed(-x.amount)}</span>
        </div>
      ))}
      <div className="bs-li">
        <span className="bs-pic rose">
          <Picto name="fer" />
        </span>
        <span className="tx">
          <b>Soins et frais des chevaux</b>
        </span>
        <span className="bs-amt">{signed(-m.direct)}</span>
      </div>
      <Link href="/seuil" className="bs-card">
        <span className="bs-pic soft">
          <Picto name="flag" />
        </span>
        <div style={{ flex: 1 }}>
          <div className="k">Ton seuil</div>
          <b>{isFinite(m.seuil) ? `${dec1(m.seuil)} chevaux paient tout · tu en as ${m.horseCount}` : "Tes pensions ne couvrent pas encore les soins"}</b>
        </div>
        <Picto name="arrowR" />
      </Link>
      <Link href="/part" className="bs-card" style={{ marginTop: 8 }}>
        <span className="bs-pic soft">
          <Picto name="foin" />
        </span>
        <div style={{ flex: 1 }}>
          <div className="k">La part de l’écurie</div>
          <b>Comment les factures communes se partagent</b>
        </div>
        <Picto name="arrowR" />
      </Link>
    </>
  );
}

/* ---------------- Leviers ---------------- */
const LEVERS: { id: Lever; title: string; picto: string; bg: string; fg: string }[] = [
  { id: "remplir", title: "Remplir", picto: "box", bg: "var(--vert-soft)", fg: "var(--vert-deep)" },
  { id: "facturer", title: "Facturer juste", picto: "euro", bg: "var(--rose-soft)", fg: "#5E2240" },
  { id: "depenser", title: "Dépenser mieux", picto: "foin", bg: "#F5ECDC", fg: "#5C4420" },
];
const STATUS: Record<Suggestion["status"], [string, string]> = {
  proposee: ["proposée", "n"],
  en_cours: ["en cours", "o"],
  faite: ["faite", "g"],
  ecartee: ["écartée", "n"],
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
  const missing = Math.max(0, objective - m.net);
  const monthly = list.filter((s) => s.status !== "faite" && s.unit !== "une fois").reduce((t, s) => t + s.gain, 0);
  const gained = list.filter((s) => s.status === "faite").reduce((t, s) => t + (s.measured ?? s.gain), 0);

  function apply(s: Suggestion) {
    const snap = { revenues: st().revenues, directExpenses: st().directExpenses, horses: st().horses, actions: st().actions };
    const undo = () => useDataStore.setState(snap);
    if (s.apply.type === "rebill") {
      st().rebillExpense(s.apply.expenseId);
      say(`Ajouté à la facture : <strong>+${eur(s.gain)}</strong>.`, undo);
    } else if (s.apply.type === "pension") {
      st().setPension(s.apply.horseId, s.apply.amount, localToday().slice(0, 7));
      st().setActionStatus(s.id, "faite");
      say(`Pension changée : <strong>+${eur(s.gain)}</strong> par mois.`, undo);
    } else if (s.apply.type === "publish") {
      st().setActionStatus(s.id, "en_cours");
      say("Action en cours. La publication sur mon-ecurie.fr arrive avec Be Stable.", undo);
    } else {
      st().setActionStatus(s.id, "en_cours");
      say(`Action en cours : <strong>${esc(s.title)}</strong>.`, undo);
    }
  }

  return (
    <>
      <div className="bs-card" style={{ display: "block" }}>
        <div className="k">{missing > 0 ? `Il manque ${eur(missing)} pour l’objectif. Ce que tu peux aller chercher :` : "Objectif tenu. Ce que tu peux encore aller chercher :"}</div>
        <span className="bs-big" style={{ fontSize: 28, color: "var(--vert)" }}>+{eur(monthly)}</span>
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}> par mois, estimé</span>
        {gained > 0 && <p className="bs-p" style={{ marginTop: 4 }}>Déjà gagné avec tes actions : <b style={{ color: "var(--vert)" }}>+{eur(gained)}</b></p>}
      </div>
      {LEVERS.map((lv) => {
        const acts = list.filter((s) => s.lever === lv.id);
        return (
          <div key={lv.id}>
            <div className="bs-lever" style={{ background: lv.bg, color: lv.fg }}>
              <Picto name={lv.picto} />
              <span className="tx">
                <b>{lv.title}</b>
                <span>{acts.length ? `${acts.length} action${acts.length > 1 ? "s" : ""}` : "rien à signaler ce mois"}</span>
              </span>
              <span className="v">+{eur(leverPotential(list, lv.id))}</span>
            </div>
            {acts.map((s) => (
              <div key={s.id} className="bs-act">
                <span className="tx">
                  <b>{s.title}</b>
                  <span>{s.sub}</span>
                  {s.status !== "faite" && (
                    <span style={{ display: "flex", gap: 12, marginTop: 4 }}>
                      <button type="button" className="bs-link" onClick={() => apply(s)}>
                        {s.apply.type === "rebill" ? "Ajouter à sa facture" : s.apply.type === "pension" ? "Appliquer au 1er du mois" : s.status === "en_cours" ? "Toujours en cours" : "Je m’en occupe"}
                      </button>
                      {s.status === "en_cours" && (
                        <button type="button" className="bs-link" onClick={() => st().setActionStatus(s.id, "faite")}>
                          C’est fait
                        </button>
                      )}
                      <button type="button" className="bs-link" style={{ color: "var(--ink-3)" }} onClick={() => st().setActionStatus(s.id, "ecartee")}>
                        Écarter
                      </button>
                    </span>
                  )}
                </span>
                <span style={{ textAlign: "right" }}>
                  <span className="bs-gain">
                    +{eur(s.measured ?? s.gain)}
                    <small>{s.status === "faite" ? "gagnés" : s.unit}</small>
                  </span>
                  <span className={`bs-pill ${STATUS[s.status][1]}`} style={{ marginTop: 4 }}>
                    {STATUS[s.status][0]}
                  </span>
                </span>
              </div>
            ))}
          </div>
        );
      })}
      <p className="bs-p" style={{ fontSize: 12, marginTop: 12 }}>Les montants sont recalculés à chaque saisie, à partir des chiffres de l’écurie.</p>
      <Link href="/scenarios" className="bs-btn line" style={{ marginTop: 10 }}>
        Simuler une hausse des pensions
      </Link>
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
  const total = bills.reduce((t, b) => t + b.total, 0);
  const paid = bills.reduce((t, b) => t + Math.min(b.paid, b.total), 0);
  const shown = bills.filter((b) => b.role === role);
  const ini = (n: string) => n.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();

  function copy() {
    const txt = shown
      .map((b) => `${b.payer} : ${eur(b.total)}${b.paid ? ` (payé ${eur(b.paid)})` : ""}\n${b.lines.map((l) => `  · ${l.label}${l.horse ? ` (${l.horse})` : ""} ${eur(l.amount)}`).join("\n")}`)
      .join("\n\n");
    navigator.clipboard?.writeText(txt).then(
      () => say("Récapitulatif copié : colle-le dans un e-mail ou ton logiciel de facturation."),
      () => say("Copie impossible sur ce navigateur."),
    );
  }

  return (
    <>
      <div className="bs-sum3">
        <div>
          <b>{eur(total)}</b>
          <span>à facturer</span>
        </div>
        <div>
          <b style={{ color: "var(--vert)" }}>{eur(paid)}</b>
          <span>déjà payés</span>
        </div>
        <div>
          <b style={{ color: "var(--rose-ink)" }}>{eur(total - paid)}</b>
          <span>en attente</span>
        </div>
      </div>
      <div className="bs-seg">
        <button type="button" aria-pressed={role === "proprietaire"} onClick={() => setRole("proprietaire")}>
          Propriétaires
        </button>
        <button type="button" aria-pressed={role === "cavalier"} onClick={() => setRole("cavalier")}>
          Cavaliers
        </button>
      </div>
      {shown.length === 0 && <p className="bs-p" style={{ marginTop: 12 }}>Rien à facturer ce mois-ci.</p>}
      {shown.map((b) => (
        <div key={b.payer} style={{ borderBottom: "1px solid var(--line-2)" }}>
          <div className="bs-act" style={{ borderBottom: 0 }}>
            <span className="bs-ini">{ini(b.payer)}</span>
            <button type="button" className="tx" style={{ textAlign: "left" }} onClick={() => setOpen(open === b.payer ? null : b.payer)} aria-expanded={open === b.payer}>
              <b>{b.payer}</b>
              <span>
                {b.lines.length} ligne{b.lines.length > 1 ? "s" : ""} · {[...new Set(b.lines.map((l) => l.horse).filter(Boolean))].join(", ")}
              </span>
            </button>
            <span style={{ textAlign: "right" }}>
              <b className="bs-amt">{eur(b.total)}</b>
              <br />
              {b.due <= 0 ? (
                <button
                  type="button"
                  className="bs-pill g"
                  onClick={() => {
                    useDataStore.getState().removePayments(b.payer, mk);
                    say(`${esc(b.payer)} : paiement retiré.`);
                  }}
                >
                  payé
                </button>
              ) : (
                <button
                  type="button"
                  className="bs-link"
                  onClick={() => {
                    const snap = useDataStore.getState().payments;
                    useDataStore.getState().addPayment(b.payer, mk, b.due);
                    say(`${esc(b.payer)} : <strong>${eur(b.due)}</strong> reçus.`, () => useDataStore.setState({ payments: snap }));
                  }}
                >
                  marquer payé
                </button>
              )}
            </span>
          </div>
          {open === b.payer && (
            <div className="bs-ticket" style={{ marginTop: 0, marginBottom: 16 }}>
              {b.lines.map((l, i) => (
                <div key={i} className="bs-tl">
                  <Picto name={pictoForLabel(l.label)} />
                  <span>
                    {l.label}
                    <small>
                      {l.horse ? `${l.horse} · ` : ""}
                      {new Date(l.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </small>
                  </span>
                  <b>{eur(l.amount)}</b>
                </div>
              ))}
              <div className="bs-tot">
                <span>Total</span>
                <span className="bs-big">{eur(b.total)}</span>
              </div>
            </div>
          )}
        </div>
      ))}
      {shown.length > 0 && (
        <button type="button" className="bs-btn" style={{ marginTop: 16 }} onClick={copy}>
          Copier le récapitulatif de {new Date(active.year, active.month - 1, 1).toLocaleDateString("fr-FR", { month: "long" })}
        </button>
      )}
    </>
  );
}

/* ---------------- Mouvements ---------------- */
function Mouvements() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const say = useUiStore((s) => s.say);
  const [kind, setKind] = useState<"tout" | "in" | "out">("tout");
  const [horse, setHorse] = useState("");
  const name = (id: string) => data.horses.find((h) => h.id === id)?.name ?? "";
  const cat = (id?: string) => [...data.revenueCategories, ...data.expenseCategories].find((c) => c.id === id)?.name;
  const rows = useMemo(() => {
    const r = data.revenues
      .filter((x) => dateInPeriod(x.date, active))
      .map((x) => ({ id: x.id, t: "rev" as const, date: x.date, label: x.note || cat(x.categoryId) || "Recette", sub: [name(x.horseId), x.payer].filter(Boolean).join(" · "), amount: x.amount, horseId: x.horseId }));
    const d = data.directExpenses
      .filter((x) => dateInPeriod(x.date, active))
      .map((x) => ({ id: x.id, t: "dir" as const, date: x.date, label: x.label, sub: [name(x.horseId), x.rebillRevenueId ? "refacturé" : ""].filter(Boolean).join(" · "), amount: -x.amount, horseId: x.horseId }));
    const s = data.sharedExpenses
      .filter((x) => x.periodYear === active.year && x.periodMonth === active.month)
      .map((x) => ({ id: x.id, t: "sh" as const, date: `${active.year}-${String(active.month).padStart(2, "0")}-01`, label: x.label, sub: `facture commune · ${x.allocations.length} chevaux`, amount: -x.totalAmount, horseId: "" }));
    return [...r, ...d, ...s]
      .filter((x) => (kind === "in" ? x.amount > 0 : kind === "out" ? x.amount < 0 : true))
      .filter((x) => !horse || x.horseId === horse)
      .sort((a, b) => b.date.localeCompare(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, active, kind, horse]);
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.date, [...(groups.get(r.date) ?? []), r]);

  function remove(r: (typeof rows)[number]) {
    const st = useDataStore.getState();
    const snap = { revenues: st.revenues, directExpenses: st.directExpenses, sharedExpenses: st.sharedExpenses };
    if (r.t === "rev") st.deleteRevenue(r.id);
    if (r.t === "dir") st.deleteDirectExpense(r.id);
    if (r.t === "sh") st.deleteSharedExpense(r.id);
    say(`Supprimé : ${esc(r.label)}.`, () => useDataStore.setState(snap));
  }

  return (
    <>
      <div className="bs-chips" style={{ marginTop: 10 }}>
        {(
          [
            ["tout", "Tout"],
            ["in", "Recettes"],
            ["out", "Dépenses"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" className="bs-chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {l}
          </button>
        ))}
        <select className="bs-chip" value={horse} onChange={(e) => setHorse(e.target.value)} aria-label="Filtrer par cheval">
          <option value="">Tous les chevaux</option>
          {data.horses.filter((h) => !h.isArchived).map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </div>
      {rows.length === 0 && <p className="bs-p" style={{ marginTop: 12 }}>Aucun mouvement.</p>}
      {[...groups.entries()].map(([d, rs]) => (
        <div key={d}>
          <Sec>{new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</Sec>
          {rs.map((r) => (
            <div key={r.id} className="bs-li">
              <span className={`bs-pic ${r.amount < 0 ? "rose" : ""}`}>
                <Picto name={pictoForLabel(r.label)} />
              </span>
              <span className="tx">
                <b>{r.label}</b>
                <span>{r.sub}</span>
              </span>
              <span className={`bs-amt ${r.amount > 0 ? "plus" : ""}`}>{signed(r.amount)}</span>
              <button type="button" className="bs-x" style={{ float: "none", margin: 0, width: 34, height: 34 }} aria-label={`Supprimer ${r.label}`} onClick={() => remove(r)}>
                <Picto name="trash" size={16} />
              </button>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
