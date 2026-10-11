"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, Sec, Tip, Toggle, cap, esc, eur, signed } from "@/components/bs/ui";
import { Picto } from "@/components/bs/picto";
import { useDesk } from "@/components/bs/desk";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { useUiStore } from "@/stores/ui-store";
import { payingCount, seanceAmount } from "@/lib/domain/seances";
import { currentPeriod, samePeriod } from "@/lib/utils/period";
import type { Prestation } from "@/lib/domain/types";

/**
 * Les prestations : ce que l'écurie vend en plus des pensions (cours,
 * travail du cheval, balades…). Pour chacune, son prix et ce qu'elle a
 * rapporté dans le mois. Un prix changé vaut pour les prochaines séances :
 * celles déjà planifiées gardent le leur.
 */
export default function Page() {
  return (
    <ClientGate>
      <Prestations />
    </ClientGate>
  );
}

type Stat = { p: Prestation; count: number; riders: number; done: number; planned: number };

function Prestations() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const step = usePeriodStore((s) => s.step);
  const openNoter = useUiStore((s) => s.openNoter);
  const desk = useDesk();
  const [edit, setEdit] = useState<string | null>(null);
  const isNow = samePeriod(active, currentPeriod());
  const mm = `${active.year}-${String(active.month).padStart(2, "0")}`;
  const monthLabel = cap(new Date(active.year, active.month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: isNow ? undefined : "numeric" }));

  const stats: Stat[] = useMemo(
    () =>
      (data.prestations ?? [])
        .map((p) => {
          const ss = (data.seances ?? []).filter((x) => x.prestationId === p.id && x.date.startsWith(mm) && x.status !== "cancelled");
          return {
            p,
            count: ss.length,
            riders: ss.reduce((t, x) => t + payingCount(x), 0),
            done: ss.filter((x) => x.status === "done").reduce((t, x) => t + seanceAmount(x), 0),
            planned: ss.filter((x) => x.status === "planned").reduce((t, x) => t + seanceAmount(x), 0),
          };
        })
        .sort((a, b) => Number(b.p.active) - Number(a.p.active) || b.done + b.planned - (a.done + a.planned)),
    [data.prestations, data.seances, mm],
  );
  const tot = stats.reduce((a, s) => ({ count: a.count + s.count, done: a.done + s.done, planned: a.planned + s.planned }), { count: 0, done: 0, planned: 0 });
  const max = Math.max(1, ...stats.map((s) => s.done + s.planned));
  const best = stats.filter((s) => s.done + s.planned > 0)[0];

  const list = (
    <>
      <Sec>Tes prestations · {stats.filter((s) => s.p.active).length}</Sec>
      {stats.length === 0 && <p className="bs-p">Aucune prestation. Ajoute la première ci-dessous.</p>}
      {stats.map((s) => (
        <Row key={s.p.id} s={s} max={max} open={edit === s.p.id} onToggle={() => setEdit(edit === s.p.id ? null : s.p.id)} onPlan={() => openNoter({ mode: "seance", prestationId: s.p.id })} />
      ))}
    </>
  );

  const side = (
    <>
      <Sec>Ajouter une prestation</Sec>
      <AddForm />
      <div style={{ marginTop: 18 }}>
        <Tip>Le prix se fige dans chaque séance au moment où tu la planifies. Changer un tarif ici vaut pour les prochaines séances ; celles déjà au planning gardent leur prix.</Tip>
      </div>
      <Link href="/argent?vue=leviers" className="bs-card" style={{ marginTop: 14 }}>
        <span className="bs-pic soft">
          <Picto name="bulb" />
        </span>
        <div style={{ flex: 1 }}>
          <div className="k">Les leviers</div>
          <b>Ce qui ferait monter le mois</b>
        </div>
        <Picto name="arrowR" />
      </Link>
    </>
  );

  return (
    <Screen wide={desk}>
      <div className="bs-over">
        <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button type="button" className="bs-back" style={{ margin: 0, minHeight: 28 }} onClick={() => step(-1)} aria-label="Mois précédent">
            <Picto name="chevL" />
          </button>
          {monthLabel}
          {!isNow && (
            <button type="button" className="bs-back" style={{ margin: 0, minHeight: 28 }} onClick={() => step(1)} aria-label="Mois suivant">
              <Picto name="chev" />
            </button>
          )}
        </span>
      </div>
      <div className="bs-dhead">
        <div>
          <h1 className="bs-d bs-t1">Prestations</h1>
          <p className="bs-p">
            Ce que tu vends en plus des pensions.
            {best ? (
              <>
                {" "}
                Ce mois, <b style={{ color: "var(--ink-1)", fontWeight: 600 }}>{best.p.label.toLowerCase()}</b> rapporte le plus.
              </>
            ) : null}
          </p>
        </div>
        {desk && (
          <button type="button" className="bs-btn" style={{ width: "auto" }} onClick={() => openNoter({ mode: "seance" })}>
            <Picto name="plus" />
            Planifier une séance
          </button>
        )}
      </div>

      <div className="bs-sum3" style={{ maxWidth: desk ? 520 : undefined }}>
        <div>
          <b>{tot.count}</b>
          <span>séances</span>
        </div>
        <div>
          <b style={{ color: "var(--vert)" }}>{signed(tot.done)}</b>
          <span>validés</span>
        </div>
        <div>
          <b style={{ color: "var(--ink-3)" }}>{signed(tot.planned)}</b>
          <span>encore prévus</span>
        </div>
      </div>

      {desk ? (
        <div className="bs-split wide-l">
          <div>{list}</div>
          <div className="stick">{side}</div>
        </div>
      ) : (
        <>
          {list}
          {side}
        </>
      )}
    </Screen>
  );
}

/** Une prestation : son prix, ce qu'elle a rapporté, et sa barre (validé plein, prévu hachuré). */
function Row({ s, max, open, onToggle, onPlan }: { s: Stat; max: number; open: boolean; onToggle: () => void; onPlan: () => void }) {
  const st = useDataStore.getState;
  const say = useUiStore((x) => x.say);
  const { p } = s;
  const upd = (patch: Partial<Prestation>) => st().updatePrestation(p.id, patch);
  return (
    <div style={{ borderBottom: "1px solid var(--line-2)", padding: "12px 0", opacity: p.active ? 1 : 0.6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="bs-pic">
          <Picto name={/balade/i.test(p.label) ? "horse" : /travail/i.test(p.label) ? "jump" : "cours"} />
        </span>
        <button type="button" onClick={onToggle} aria-expanded={open} style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <b style={{ display: "block", fontSize: 15, fontWeight: 600, color: "var(--ink-1)" }}>
            {p.label}
            {!p.active && <span className="bs-pill n" style={{ marginLeft: 8 }}>en pause</span>}
          </b>
          <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
            {eur(p.price)} {p.hasFormat ? "par cavalier" : "la séance"}
            {p.hasFormat ? " · particulier ou collectif" : ""}
            {s.count ? ` · ${s.count} séance${s.count > 1 ? "s" : ""}, ${s.riders} cavalier${s.riders > 1 ? "s" : ""}` : " · rien ce mois"}
          </span>
        </button>
        <span style={{ textAlign: "right" }}>
          <b className="bs-amt plus" style={{ fontSize: 15 }}>
            {s.done ? signed(s.done) : "0 €"}
          </b>
          {s.planned > 0 && <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>+{eur(s.planned)} prévus</span>}
        </span>
      </div>
      <div style={{ display: "flex", height: 6, marginTop: 9, marginLeft: 50, borderRadius: 2, overflow: "hidden", background: "var(--line-2)" }} aria-hidden>
        <i style={{ width: `${(s.done / max) * 100}%`, background: "var(--vert)" }} />
        <i style={{ width: `${(s.planned / max) * 100}%`, background: "repeating-linear-gradient(135deg,var(--vert-soft) 0 3px,#fff 3px 6px)", boxShadow: "inset 0 0 0 1px var(--on-vert)" }} />
      </div>

      {open && (
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8, background: "#fff", boxShadow: "inset 0 0 0 1px var(--line-2)", borderRadius: 6, padding: "4px 12px 12px" }}>
          <label className="bs-field">
            <span>Nom</span>
            <input defaultValue={p.label} onChange={(e) => e.target.value.trim() && upd({ label: e.target.value.trim() })} />
          </label>
          <label className="bs-field">
            <span>Prix</span>
            <input inputMode="decimal" defaultValue={p.price} style={{ textAlign: "right", fontWeight: 600 }} onChange={(e) => Number(e.target.value.replace(",", ".")) >= 0 && upd({ price: Number(e.target.value.replace(",", ".")) || 0 })} />
            <span>€</span>
          </label>
          <Toggle on={!!p.hasFormat} onClick={() => upd({ hasFormat: !p.hasFormat })}>
            Cours particulier ou collectif (prix par cavalier)
          </Toggle>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
            {p.active && (
              <button type="button" className="bs-link" onClick={onPlan}>
                Planifier une séance
              </button>
            )}
            <button type="button" className="bs-link" style={{ color: "var(--ink-2)" }} onClick={() => upd({ active: !p.active })}>
              {p.active ? "Mettre en pause" : "Reprendre"}
            </button>
            <button
              type="button"
              className="bs-link"
              style={{ color: "var(--rose-ink)" }}
              onClick={() => {
                const snap = st().prestations;
                const r = st().removePrestation(p.id);
                say(
                  r === "supprimee" ? `Prestation retirée : ${esc(p.label)}.` : `${esc(p.label)} a déjà des séances : elle passe en pause, l’historique reste.`,
                  () => useDataStore.setState({ prestations: snap }),
                );
              }}
            >
              Retirer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddForm() {
  const say = useUiStore((s) => s.say);
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [fmt, setFmt] = useState(false);
  const n = Number(price.replace(",", "."));
  const ok = label.trim().length > 1 && n > 0;
  function add() {
    if (!ok) return;
    useDataStore.getState().addPrestation({ label: label.trim(), price: n, hasFormat: fmt });
    say(`Prestation ajoutée : <strong>${esc(label.trim())}</strong> à ${eur(n)}.`);
    setLabel("");
    setPrice("");
    setFmt(false);
  }
  return (
    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
      <label className="bs-field">
        <span>Nom</span>
        <input placeholder="Ex. Stage poney, Longe, Transport concours" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
      </label>
      <label className="bs-field">
        <span>Prix</span>
        <input inputMode="decimal" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} style={{ textAlign: "right", fontWeight: 600 }} />
        <span>€</span>
      </label>
      <Toggle on={fmt} onClick={() => setFmt(!fmt)}>
        Cours particulier ou collectif (prix par cavalier)
      </Toggle>
      <button type="button" className="bs-btn" onClick={add} disabled={!ok}>
        Ajouter la prestation
      </button>
    </div>
  );
}
