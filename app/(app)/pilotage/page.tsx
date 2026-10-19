"use client";

import Link from "next/link";
import { libelleFrais } from "@/components/bs/parcours";
import { useMemo, useState } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { cap, dec1 } from "@/components/bs/ui";
import { useDesk } from "@/components/bs/desk-hook";
import { CountUp, Empty, Face, Hello, Ic, Ill, Money, Page, Sec, Seg, eur, sg } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown, reconciledNets } from "@/lib/domain/ticket";
import { seanceAmount } from "@/lib/domain/seances";
import { addMonths, currentPeriod, lastNPeriods, samePeriod } from "@/lib/utils/period";
import type { Period } from "@/lib/domain/types";
import { hasObjective } from "@/lib/domain/objectif";
import { montantCommun } from "@/lib/domain/lecture";

/**
 * Bilan sur plusieurs mois : les mois mis bout à bout. Les mêmes calculs que « Le mois »
 * (ce qui est validé), sur 3, 6 ou 12 mois : le résultat, mois par mois
 * face à l'objectif, ce qui pèse, ce qui a bougé, les chevaux et les
 * prestations sur la période. Rien ne se saisit ici.
 */
export default function Page_() {
  return (
    <ClientGate>
      <Bilans />
    </ClientGate>
  );
}

type Span = "3" | "6" | "12" | "an";
const SPANS: [Span, string][] = [
  ["3", "3 mois"],
  ["6", "6 mois"],
  ["12", "12 mois"],
  ["an", "Cette année"],
];
const mName = (p: Period, style: "long" | "short" = "long") => new Date(p.year, p.month - 1, 1).toLocaleDateString("fr-FR", { month: style });

function icFor(label: string): string {
  const l = label.toLowerCase();
  if (/pension|retraite|box/.test(l)) return "horse";
  if (/foin/.test(l)) return "hay";
  if (/loyer|fermage/.test(l)) return "home";
  if (/granul|aliment/.test(l)) return "board";
  if (/liti|paille|copeau/.test(l)) return "list";
  if (/assurance/.test(l)) return "doc";
  if (/maréchal|marechal|ferr/.test(l)) return "shoe";
  if (/soin|véto|veto|vacc|vermif|compl/.test(l)) return "syringe";
  if (/balade/.test(l)) return "flag";
  if (/stage/.test(l)) return "cal";
  if (/travail/.test(l)) return "horse";
  if (/salaire|cours|séance|seance/.test(l)) return "user";
  return "euro";
}

function Bilans() {
  const data = useDataStore();
  const objective = useSettingsStore((s) => s.objective);
  const desk = useDesk();
  const [span, setSpan] = useState<Span>("6");
  const now = currentPeriod();
  const periods = useMemo(() => (span === "an" ? lastNPeriods(now, now.month) : lastNPeriods(now, Number(span))), [span, now.year, now.month]); // eslint-disable-line react-hooks/exhaustive-deps

  const months = useMemo(() => periods.map((p) => ({ p, m: monthBreakdown(data, p) })), [data, periods]);
  const revenue = months.reduce((t, x) => t + x.m.revenue, 0);
  // Tout ce qui est sorti, hors chevaux compris (tracteur, matériel…), comme dans Mon bilan.
  const charges = months.reduce((t, x) => t + x.m.direct + x.m.sharedTotal + x.m.outside, 0);
  const net = months.reduce((t, x) => t + x.m.net, 0);
  const avg = net / Math.max(1, months.length);
  const keep = revenue > 0 ? Math.round((net / revenue) * 100) : 0;
  const reachedList = hasObjective(objective) ? months.filter((x) => x.m.net >= objective) : [];
  const reached = reachedList.length;
  const cur = months[months.length - 1]?.m;

  // Ce qui pèse sur la période : les factures communes par poste, et les soins.
  const weights = useMemo(() => {
    const map = new Map<string, number>();
    for (const { m } of months) {
      for (const s of m.shared) map.set(s.label, (map.get(s.label) ?? 0) + s.amount);
      map.set("Soins et frais des chevaux", (map.get("Soins et frais des chevaux") ?? 0) + m.direct);
      for (const o of m.outs) map.set(o.label, (map.get(o.label) ?? 0) + o.amount);
    }
    return [...map.entries()].map(([label, amount]) => ({ label, amount })).filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount);
  }, [months]);
  const wMax = Math.max(1, ...weights.map((w) => w.amount));

  // Ce qui a bougé : ce mois face au mois d'avant, poste par poste.
  const movers = useMemo(() => {
    const a = monthBreakdown(data, now);
    const b = monthBreakdown(data, addMonths(now, -1));
    const toMap = (m: typeof a) => new Map([...m.shared.map((s) => [s.label, s.amount] as const), ["Soins et frais des chevaux", m.direct] as const]);
    const ca = toMap(a);
    const cb = toMap(b);
    return [...new Set([...ca.keys(), ...cb.keys()])]
      .map((label) => ({ label, cur: ca.get(label) ?? 0, delta: (ca.get(label) ?? 0) - (cb.get(label) ?? 0) }))
      .filter((x) => Math.abs(x.delta) >= 1)
      .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
      .slice(0, 5);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Les chevaux sur la période.
  const horses = useMemo(() => {
    const sum: Record<string, number> = {};
    for (const p of periods) for (const [id, v] of Object.entries(reconciledNets(data, p))) sum[id] = (sum[id] ?? 0) + v;
    // Les chevaux de la période, même partis depuis : ils ont compté dans ces mois.
    return data.horses
      .filter((h) => !h.isArchived || sum[h.id] !== undefined)
      .map((h) => ({ h, net: sum[h.id] ?? 0 }))
      .sort((a, b) => b.net - a.net);
  }, [data, periods]);

  // Les prestations validées sur la période.
  const prests = useMemo(() => {
    const inR = (d: string) => periods.some((p) => d.startsWith(`${p.year}-${String(p.month).padStart(2, "0")}`));
    return (data.prestations ?? [])
      .map((p) => {
        const ss = (data.seances ?? []).filter((x) => x.prestationId === p.id && x.status === "done" && inR(x.date));
        return { p, n: ss.length, amount: ss.reduce((t, x) => t + seanceAmount(x), 0) };
      })
      .filter((x) => x.n > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [data, periods]);

  if (!data.horses.some((h) => !h.isArchived))
    return (
      <Page>
        <Hello title="Sur plusieurs mois" />
        <Empty ill="dodo">Pas encore grand-chose à montrer. Ajoute tes chevaux et note tes premières séances : les mois vont se remplir petit à petit.</Empty>
        <div className="pad" style={{ marginTop: 14 }}>
          <Link href="/parcours" className="btn full">
            Reprendre mes premiers pas
          </Link>
        </div>
      </Page>
    );

  const first = periods[0];
  const rangeLabel = periods.length > 1 ? `De ${mName(first)} à ${mName(now)}.` : `${cap(mName(now))}.`;
  const losers = horses.filter((x) => x.net < 0);
  const prev = mName(addMonths(now, -1));
  // Tous les chevaux ont laissé la même chose : une ligne au lieu de neuf pareilles.
  const commun = montantCommun(horses.map((x) => x.net));

  const hero = (
    <div className="card ar-hero6 rise" style={{ animationDelay: ".05s" }}>
      <p className="k">{Math.round(net) < 0 ? `Ce qui t’a manqué sur ${months.length} mois` : `Ce qui t’est resté sur ${months.length} mois`}</p>
      <p className={`big ${net > 0 ? "in" : net < 0 ? "out" : ""}`}>
        <CountUp value={net} fmt={(x) => eur(Math.abs(x))} />
      </p>
      <span className="ar-avg">
        soit <Money v={avg} plain /> par mois en moyenne
      </span>
      <p className="note">
        {rangeLabel} {net >= 0 ? `Sur 100 € qui rentrent, il t’en reste ${keep}.` : "Sur ces mois-là, l’écurie t’a coûté plus qu’elle ne t’a rapporté. Beaucoup d’écuries passent par là. Regarde juste en dessous où part l’argent."}
      </p>
      {hasObjective(objective) && (
        <div className="ar-reach">
          {reached > 0 && <Ill n="rosette" />}
          <span>
            {reached > 0 ? (
              <>
                <b>
                  Objectif atteint {reached} mois sur {months.length}
                </b>{" "}
                : {reachedList.map((x) => mName(x.p)).join(", ").replace(/, ([^,]*)$/, " et $1")}.
              </>
            ) : (
              <>
                <b>Objectif de {eur(objective)} pas encore atteint</b> sur ces {months.length} mois.
              </>
            )}
          </span>
        </div>
      )}
      <div className="trio">
        <div>
          <b className="in">{sg(revenue)}</b>
          <small>ce qui est rentré</small>
        </div>
        <div>
          <b className="out">{sg(-charges)}</b>
          <small>ce qui est sorti</small>
        </div>
        <div>
          <b>{cur && isFinite(cur.seuil) ? Math.ceil(cur.seuil - 1e-9) : "pas encore"}</b>
          <small>pensions pour tout payer</small>
        </div>
      </div>
    </div>
  );

  const left = (
    <>
      <Sec ill="carnet-buste" title="Mois par mois" action={<Link href="/argent">Ce mois-ci</Link>} delay={0.14}>
        <MonthChart months={months.map((x) => ({ p: x.p, net: x.m.net }))} objective={objective} />
        <p className="note">{hasObjective(objective) ? `Pointillé : ton objectif de ${eur(objective)}. ` : ""}{cap(mName(now))} est en cours.</p>
      </Sec>
      <Sec ill="brouette" title="Où va ton argent" action={<span className="act out">{sg(-charges)}</span>} delay={0.22}>
        {weights.slice(0, 7).map((w, i) => (
          <div key={w.label} className="ar-wgt">
            <div className="ar-t">
              <span>{libelleFrais(w.label)}</span>
              <em>{`${Math.round((w.amount / Math.max(1, charges)) * 100)}\u00a0%`}</em>
              <Money v={-w.amount} />
            </div>
            <div className="ar-tr" aria-hidden="true">
              <i style={{ width: `${(w.amount / wMax) * 100}%`, animationDelay: `${i * 0.06}s` }} />
            </div>
          </div>
        ))}
        {weights.length === 0 && <p className="note">Rien n’est sorti sur cette période.</p>}
      </Sec>
      {movers.length > 0 && (
        <Sec ill="piste" title={`Ce qui a changé depuis ${prev}`} delay={0.3}>
          {movers.map((x) => (
            <div key={x.label} className="ar-post">
              <span className={`ar-arr ${x.delta > 0 ? "up" : "dn"}`}>
                <Ic n="arrow" className="ar-ic" />
              </span>
              <span>
                {libelleFrais(x.label)}
                <small>
                  {eur(x.cur)} ce mois-ci, {eur(Math.abs(x.delta))} de {x.delta > 0 ? "plus" : "moins"}
                </small>
              </span>
              <Money v={-x.delta} />
            </div>
          ))}
        </Sec>
      )}
    </>
  );

  const right = (
    <>
      <Sec ill="tete-fondu" title="Ce que chaque cheval t’a laissé" action={<Link href="/chevaux">Voir tous</Link>} delay={0.38}>
        {losers.length > 0 && (
          <p className="ar-lose">
            <b>
              {losers.length} cheva{losers.length > 1 ? "ux t’ont coûté" : "l t’a coûté"} plus qu’{losers.length > 1 ? "ils ne rapportent" : "il ne rapporte"}
            </b>{" "}
            sur ces {months.length} mois : {losers.map((x) => x.h.name).join(", ")}.
          </p>
        )}
        {commun !== null ? (
          <Link href="/chevaux" className="li">
            <span className="ar-pic">
              <Ic n="horse" className="ar-ic" />
            </span>
            <span>
              <b>Tes {horses.length} chevaux</b>
              <small>{sg(commun / Math.max(1, months.length))} par mois en moyenne</small>
            </span>
            <span className={`pill${commun > 0 ? " in" : commun < 0 ? " out" : ""}`}>{sg(commun)} chacun</span>
          </Link>
        ) : (
          horses.map(({ h, net: n }) => (
            <Link key={h.id} href={`/ticket?id=${h.id}`} className="li">
              <Face horse={h} />
              <span>
                <b>{h.name}</b>
                <small>{sg(n / Math.max(1, months.length))} par mois en moyenne</small>
              </span>
              <span className={`pill${Math.round(n) > 0 ? " in" : Math.round(n) < 0 ? " out" : ""}`}>{sg(n)}</span>
            </Link>
          ))
        )}
      </Sec>
      <Sec ill="confirmer" title="Ce que rapportent tes cours" action={<Link href="/prestations">Tes cours</Link>} delay={0.46}>
        {prests.length === 0 ? (
          <p className="note">Pas encore de séance sur ces mois-là. Note-les dans le planning : une fois passées, elles comptent toutes seules.</p>
        ) : (
          prests.map((x) => (
            <div key={x.p.id} className="ar-post">
              <span className="ar-pic">
                <Ic n={icFor(x.p.label)} className="ar-ic" />
              </span>
              <span>
                {x.p.label}
                <small>
                  {x.n} séance{x.n > 1 ? "s" : ""} qui {x.n > 1 ? "ont" : "a"} eu lieu
                </small>
              </span>
              <Money v={x.amount} />
            </div>
          ))
        )}
      </Sec>
      <Sec ill="guide" title="Voir aussi" delay={0.54}>
        {(
          [
            ["/seuil", "flag", "Combien de chevaux pour ne pas perdre d’argent", "le nombre de pensions qui paient tout"],
            ["/scenarios/nouveau", "chart", "Et si… ?", "voir ce que donnerait une pension plus chère, sans rien changer"],
            ["/argent?vue=mouvements", "list", "Ce qui rentre et ce qui sort", "chaque ligne, une par une"],
          ] as const
        ).map(([href, pic, t, s]) => (
          <Link key={href} href={href} className="li">
            <span className="ar-pic">
              <Ic n={pic} className="ar-ic" />
            </span>
            <span>
              <b>{t}</b>
              <small>{s}</small>
            </span>
            <Ic n="chev" className="chev" />
          </Link>
        ))}
      </Sec>
    </>
  );

  return (
    <Page wide={desk}>
      <h1 className="ar-sr">Sur plusieurs mois</h1>
      <div className="ar-bseg" style={{ marginTop: 12 }}>
        <Seg value={span} onChange={setSpan} options={SPANS} label="Période" />
      </div>
      {hero}
      {desk ? (
        <div className="ar-split">
          <div>{left}</div>
          <div>{right}</div>
        </div>
      ) : (
        <>
          {left}
          {right}
        </>
      )}
      <div className="end" />
    </Page>
  );
}

/**
 * Le résultat mois par mois : barres à l'encre (hachurées sous zéro), le
 * mois en cours cerclé ; le trait pointillé est l'objectif.
 */
function MonthChart({ months, objective }: { months: { p: Period; net: number }[]; objective: number }) {
  const H = 150;
  const BASE = 20;
  const pos = Math.max(objective, 1, ...months.map((m) => m.net));
  const neg = Math.max(0, ...months.map((m) => -m.net));
  const scale = H / (pos + neg);
  const zero = BASE + neg * scale; // distance depuis le bas
  const now = currentPeriod();
  const many = months.length > 8;
  const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
  const lab = (v: number) => (many ? `${dec1(v / 1000)} k` : `${Math.round(v) < 0 ? "−" : ""}${nf.format(Math.abs(Math.round(v))).replace(/\u202f/g, "\u00a0")}`);
  const aria = `Ce qui t’est resté : ${months.map((m) => `${mName(m.p)} ${sg(m.net)}`).join(", ")}.${hasObjective(objective) ? ` Objectif ${eur(objective)}.` : ""}`;
  return (
    <div className="ar-mc" role="img" aria-label={aria} style={{ height: H + BASE + 18, gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`, gap: many ? 4 : 8 }}>
      <span className="ar-base" style={{ bottom: zero }} />
      {hasObjective(objective) && <span className="ar-obj" style={{ bottom: zero + objective * scale }} />}
      {months.map(({ p, net }, i) => {
        const isNow = samePeriod(p, now);
        const h = Math.max(2, Math.abs(net) * scale);
        return (
          <div key={`${p.year}-${p.month}`} className={`ar-m${isNow ? " now" : ""}`} title={`${cap(mName(p))} : ${sg(net)}`}>
            <i className={net < 0 ? "neg" : undefined} style={{ bottom: net >= 0 ? zero : zero - h, height: h, animationDelay: `${i * 0.06}s` }} />
            <em style={{ bottom: net >= 0 ? zero + h + 4 : zero + 4 }}>{lab(net)}</em>
            <small>{mName(p, "short").replace(".", "")}</small>
          </div>
        );
      })}
    </div>
  );
}
