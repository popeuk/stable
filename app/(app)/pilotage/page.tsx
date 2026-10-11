"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { NetPill, Screen, Sec, cap, dec1, eur, signed } from "@/components/bs/ui";
import { Picto, pictoForLabel } from "@/components/bs/picto";
import { HorseFace } from "@/components/bs/horse-face";
import { useDesk } from "@/components/bs/desk";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown, reconciledNets } from "@/lib/domain/ticket";
import { seanceAmount } from "@/lib/domain/seances";
import { addMonths, currentPeriod, lastNPeriods, samePeriod } from "@/lib/utils/period";
import type { Period } from "@/lib/domain/types";

/**
 * Les bilans : les mois mis bout à bout. Les mêmes calculs que « Le mois »
 * (ce qui est validé), sur 3, 6 ou 12 mois : le résultat, mois par mois
 * face à l'objectif, ce qui pèse, ce qui a bougé, les chevaux et les
 * prestations sur la période. Rien ne se saisit ici.
 */
export default function Page() {
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

function Bilans() {
  const data = useDataStore();
  const objective = useSettingsStore((s) => s.objective);
  const desk = useDesk();
  const [span, setSpan] = useState<Span>("6");
  const now = currentPeriod();
  const periods = useMemo(() => (span === "an" ? lastNPeriods(now, now.month) : lastNPeriods(now, Number(span))), [span, now.year, now.month]); // eslint-disable-line react-hooks/exhaustive-deps

  const months = useMemo(() => periods.map((p) => ({ p, m: monthBreakdown(data, p) })), [data, periods]);
  const revenue = months.reduce((t, x) => t + x.m.revenue, 0);
  const charges = months.reduce((t, x) => t + x.m.direct + x.m.sharedTotal, 0);
  const net = months.reduce((t, x) => t + x.m.net, 0);
  const avg = net / Math.max(1, months.length);
  const keep = revenue > 0 ? Math.round((net / revenue) * 100) : 0;
  const reached = months.filter((x) => x.m.net >= objective).length;
  const cur = months[months.length - 1]?.m;

  // Ce qui pèse sur la période : les factures communes par poste, et les soins.
  const weights = useMemo(() => {
    const map = new Map<string, number>();
    for (const { m } of months) {
      for (const s of m.shared) map.set(s.label, (map.get(s.label) ?? 0) + s.amount);
      map.set("Soins et frais des chevaux", (map.get("Soins et frais des chevaux") ?? 0) + m.direct);
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
    return data.horses
      .filter((h) => !h.isArchived)
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
      <Screen>
        <h1 className="bs-d bs-t1" style={{ marginTop: 14 }}>
          Bilans
        </h1>
        <p className="bs-p">Encore rien à mettre bout à bout. Ajoute tes chevaux et valide tes premières journées : les bilans se construisent tout seuls.</p>
        <Link href="/parcours" className="bs-btn" style={{ marginTop: 16 }}>
          Reprendre le parcours
        </Link>
      </Screen>
    );

  const first = periods[0];
  const rangeLabel = periods.length > 1 ? `de ${mName(first)} à ${mName(now)}` : cap(mName(now));
  const losers = horses.filter((x) => x.net < 0);

  const hero = (
    <div className="bs-goal" style={{ padding: "16px 18px" }}>
      <div className="k">
        Ton résultat {rangeLabel} · {months.length} mois
      </div>
      <div className="row">
        <span className={`bs-big${net < 0 ? " neg" : ""}`} style={{ fontSize: 44 }}>
          {signed(net)}
        </span>
        <span style={{ fontSize: 13, color: "var(--on-vert)", textAlign: "right" }}>
          soit <b style={{ color: "#fff", fontVariantNumeric: "tabular-nums" }}>{signed(avg)}</b>
          <br />
          par mois en moyenne
        </span>
      </div>
      <p style={{ fontSize: 14, color: "#fff", marginTop: 8, lineHeight: 1.45 }}>
        {net >= 0 ? `Tu gardes ${keep} % de ce que tu encaisses.` : "Sur la période, l’écurie te coûte de l’argent."}{" "}
        {reached}/{months.length} mois au-dessus de ton objectif de {eur(objective)}.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, borderTop: "1px solid rgba(255,255,255,.18)", marginTop: 12, paddingTop: 10 }}>
        {(
          [
            ["Encaissé", eur(revenue)],
            ["Dépensé", eur(charges)],
            ["chevaux paient tout", cur && isFinite(cur.seuil) ? dec1(cur.seuil) : "non atteint"],
          ] as const
        ).map(([k, v]) => (
          <div key={k}>
            <b style={{ display: "block", fontSize: 17, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#fff" }}>{v}</b>
            <span style={{ fontSize: 11.5, color: "var(--on-vert)" }}>{k}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const chart = <MonthChart months={months.map((x) => ({ p: x.p, net: x.m.net }))} objective={objective} />;

  const left = (
    <>
      <Sec action={<Link href="/argent">Le mois</Link>}>Mois par mois</Sec>
      {chart}
      <Sec>Ce qui pèse · {eur(charges)}</Sec>
      {weights.slice(0, 7).map((w, i) => (
        <div key={w.label} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
            <Picto name={pictoForLabel(w.label)} size={17} />
            <span style={{ flex: 1, color: "var(--ink-1)", fontWeight: 500 }}>{w.label}</span>
            <span style={{ fontSize: 12, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{Math.round((w.amount / Math.max(1, charges)) * 100)} %</span>
            <b className="bs-amt" style={{ minWidth: 76, textAlign: "right" }}>
              {eur(w.amount)}
            </b>
          </div>
          <div style={{ height: 5, borderRadius: 2, background: "var(--line-2)", marginTop: 6, marginLeft: 27, overflow: "hidden" }} aria-hidden>
            <i style={{ display: "block", height: "100%", width: `${(w.amount / wMax) * 100}%`, background: i === 0 ? "var(--ink-1)" : "var(--vert-deep)", opacity: i === 0 ? 1 : 0.55, borderRadius: 2 }} />
          </div>
        </div>
      ))}
      {movers.length > 0 && (
        <>
          <Sec>Ce qui a bougé depuis {mName(addMonths(now, -1))}</Sec>
          {movers.map((x) => (
            <div key={x.label} className="bs-li" style={{ padding: "9px 0" }}>
              <span className={`bs-pic sm${x.delta > 0 ? " rose" : ""}`}>
                <Picto name={x.delta > 0 ? "up" : "down"} />
              </span>
              <span className="tx">
                <b>{x.label}</b>
                <span>{eur(x.cur)} ce mois</span>
              </span>
              <b className="bs-amt" style={{ color: x.delta > 0 ? "var(--rose-ink)" : "var(--vert)" }}>
                {x.delta > 0 ? "+" : "−"}
                {eur(Math.abs(x.delta))}
              </b>
            </div>
          ))}
          <p className="bs-p" style={{ fontSize: 12 }}>En rose ce qui coûte plus que le mois dernier, en vert ce qui coûte moins.</p>
        </>
      )}
    </>
  );

  const right = (
    <>
      {losers.length > 0 && (
        <Link href="/chevaux" className="bs-banner" style={{ marginTop: desk ? 22 : 10 }}>
          <Picto name="horse" />
          <span style={{ flex: 1 }}>
            <b>
              {losers.length} cheva{losers.length > 1 ? "ux te coûtent" : "l te coûte"}
            </b>{" "}
            sur la période : {losers.map((x) => x.h.name).join(", ")}
          </span>
          <Picto name="chev" />
        </Link>
      )}
      <Sec action={<Link href="/chevaux">Tous</Link>}>Tes chevaux sur la période</Sec>
      {horses.map(({ h, net: n }) => (
        <Link key={h.id} href={`/ticket?id=${h.id}`} className="bs-li tap" style={{ padding: "8px 0" }}>
          <HorseFace horse={h} size={34} />
          <span className="tx">
            <b>{h.name}</b>
            <span>{signed(n / Math.max(1, months.length))} par mois</span>
          </span>
          <NetPill value={n} />
        </Link>
      ))}
      <Sec action={<Link href="/prestations">Prestations</Link>}>Ce que rapportent tes prestations</Sec>
      {prests.length === 0 ? (
        <p className="bs-p">Aucune séance validée sur la période.</p>
      ) : (
        prests.map((x) => (
          <div key={x.p.id} className="bs-li" style={{ padding: "8px 0" }}>
            <span className="bs-pic sm">
              <Picto name="cours" />
            </span>
            <span className="tx">
              <b>{x.p.label}</b>
              <span>
                {x.n} séance{x.n > 1 ? "s" : ""} validée{x.n > 1 ? "s" : ""}
              </span>
            </span>
            <b className="bs-amt plus">{signed(x.amount)}</b>
          </div>
        ))
      )}
      <Sec>Pour aller plus loin</Sec>
      {(
        [
          ["/seuil", "flag", "Ton seuil", "combien de chevaux paient tout"],
          ["/scenarios/nouveau", "chart", "Et si…", "simuler une hausse de pension ou une place louée"],
          ["/argent?vue=mouvements", "list", "Tous les mouvements", "chaque recette et chaque dépense"],
        ] as const
      ).map(([href, pic, t, s]) => (
        <Link key={href} href={href} className="bs-li tap">
          <span className="bs-pic soft">
            <Picto name={pic} />
          </span>
          <span className="tx">
            <b>{t}</b>
            <span>{s}</span>
          </span>
          <Picto name="chev" />
        </Link>
      ))}
    </>
  );

  return (
    <Screen wide={desk}>
      <div className="bs-dhead" style={{ marginTop: desk ? 0 : 14 }}>
        <div>
          <h1 className="bs-d bs-t1">Bilans</h1>
          <p className="bs-p">Tes mois mis bout à bout, à partir de ce que tu as validé.</p>
        </div>
        <div className="bs-seg" style={{ marginTop: desk ? 0 : 12, width: desk ? 400 : "100%" }}>
          {SPANS.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={span === k} onClick={() => setSpan(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {desk ? (
        <>
          <div style={{ maxWidth: 720 }}>{hero}</div>
          <div className="bs-split wide-l">
            <div>{left}</div>
            <div className="stick">{right}</div>
          </div>
        </>
      ) : (
        <>
          {hero}
          {left}
          {right}
        </>
      )}
    </Screen>
  );
}

/**
 * Le résultat mois par mois : vert au-dessus de zéro, encre en dessous, le
 * mois en cours cerclé de rose ; la ligne pointillée rose est l'objectif.
 */
function MonthChart({ months, objective }: { months: { p: Period; net: number }[]; objective: number }) {
  const H = 168;
  const pos = Math.max(objective, 1, ...months.map((m) => m.net));
  const neg = Math.max(0, ...months.map((m) => -m.net));
  const zero = (pos / (pos + neg)) * H;
  const scale = H / (pos + neg);
  const now = currentPeriod();
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ position: "relative", height: H + 22, display: "grid", gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`, gap: months.length > 8 ? 4 : 10 }}>
        <div aria-hidden style={{ position: "absolute", left: 0, right: 0, top: zero, borderTop: "1px solid var(--ink-3)" }} />
        <div aria-hidden style={{ position: "absolute", left: 0, right: 0, top: zero - objective * scale, borderTop: "1.5px dashed var(--rose-ink)", opacity: 0.7 }}>
          <span style={{ position: "absolute", left: 0, top: 2, fontSize: 10.5, fontWeight: 600, color: "var(--rose-ink)", background: "var(--paper)", paddingLeft: 4 }}>objectif {eur(objective)}</span>
        </div>
        {months.map(({ p, net }) => {
          const isNow = samePeriod(p, now);
          const h = Math.max(2, Math.abs(net) * scale);
          return (
            <div key={`${p.year}-${p.month}`} style={{ position: "relative" }} title={`${cap(mName(p))} : ${signed(net)}`}>
              <i
                style={{
                  position: "absolute",
                  left: "14%",
                  right: "14%",
                  top: net >= 0 ? zero - h : zero,
                  height: h,
                  background: net >= 0 ? "var(--vert)" : "var(--ink-1)",
                  borderRadius: net >= 0 ? "3px 3px 0 0" : "0 0 3px 3px",
                  boxShadow: isNow ? "0 0 0 2px var(--paper), 0 0 0 4px var(--rose)" : undefined,
                }}
              />
              <span style={{ position: "absolute", left: 0, right: 0, textAlign: "center", top: net >= 0 ? zero - h - 16 : zero - 16, fontSize: 10.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: net >= 0 ? "var(--vert)" : "var(--ink-1)", whiteSpace: "nowrap" }}>
                {months.length > 8 ? `${dec1(net / 1000)} k` : signed(net)}
              </span>
              <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, textAlign: "center", fontSize: 11, color: isNow ? "var(--ink-1)" : "var(--ink-3)", fontWeight: isNow ? 650 : 500 }}>{mName(p, "short").replace(".", "")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
