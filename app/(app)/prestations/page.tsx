"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, cap, esc, eur } from "@/components/bs/ui";
import { useDesk } from "@/components/bs/desk";
import { CountUp, Hello, Ic, Ill, Sec, Switch, Tip, sg } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { useUiStore } from "@/stores/ui-store";
import { payingCount, seanceAmount } from "@/lib/domain/seances";
import { currentPeriod, samePeriod } from "@/lib/utils/period";
import type { Prestation } from "@/lib/domain/types";
import { lireMontant, montantEnTexte, montantOuZero, saisieMontant } from "@/lib/utils/montant";

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

const nfmt = (n: number) => String(Math.round(n));

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
  const auJour = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

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
    <Sec ill="carnet-buste" title={`Ce que tu proposes · ${stats.filter((s) => s.p.active).length}`} delay={0.2}>
      {stats.length === 0 && <p className="note">Tu n’as encore rien ajouté. Cours, balades, travail du cheval : ajoute ce que tu proposes juste en dessous.</p>}
      {stats.map((s) => (
        <Row key={s.p.id} s={s} max={max} open={edit === s.p.id} onToggle={() => setEdit(edit === s.p.id ? null : s.p.id)} onPlan={() => openNoter({ mode: "seance", prestationId: s.p.id })} />
      ))}
    </Sec>
  );

  const side = (
    <>
      <Sec ill="carnet" title="Ajouter un cours ou un service" blk delay={0.3}>
        <AddForm />
      </Sec>
      <div className="pad rise" style={{ marginTop: 14, animationDelay: ".36s" }}>
        <Tip ill="sacoche">
          <b>Un prix changé vaut pour la suite.</b> Les séances déjà au planning gardent leur ancien prix.
        </Tip>
      </div>
      <Link href="/argent?vue=leviers" className="ec-lcard rise" style={{ animationDelay: ".42s" }}>
        <Ill n="piste" />
        <span>
          <span className="k">Pistes pour gagner plus</span>
          <b>Des idées pour qu’il te reste plus à la fin du mois</b>
        </span>
        <Ic n="arrow" className="arr" />
      </Link>
    </>
  );

  return (
    <Screen wide={desk}>
      <div className="ec-pg">
        <div className="over rise" style={{ animationDelay: ".02s" }}>
          <span className="ec-mnav">
            <button type="button" onClick={() => step(-1)} aria-label="Mois précédent">
              <Ic n="chevL" className="" />
            </button>
            {monthLabel}
            <button type="button" className={isNow ? "dis" : ""} onClick={() => step(1)} aria-label="Mois suivant" disabled={isNow}>
              <Ic n="chev" className="" />
            </button>
          </span>
          {isNow && <span>au {auJour}</span>}
        </div>
        <div className="ec-hrow">
          <Hello title={best ? `${best.p.label} rapporte le plus ce mois-ci.` : "Cours et services"} sub="Cours, balades, travail du cheval : tout ce que tu vends en plus des pensions." delay={0.06} />
          {desk && (
            <button type="button" className="btn" onClick={() => openNoter({ mode: "seance" })}>
              <Ic n="plus" className="" />
              Planifier une séance
            </button>
          )}
        </div>
        <div className="pad rise" style={{ marginTop: 14, animationDelay: ".12s" }}>
          <div className="trio ec-trio">
            <div>
              <b>
                <CountUp value={tot.count} fmt={nfmt} />
              </b>
              <small>séance{tot.count > 1 ? "s" : ""}</small>
            </div>
            <div>
              <b className={tot.done > 0 ? "in" : ""}>
                <CountUp value={tot.done} />
              </b>
              <small>déjà faites</small>
            </div>
            <div>
              <b className="pl2">{sg(tot.planned)}</b>
              <small>encore prévues ce mois</small>
            </div>
          </div>
        </div>

        {desk ? (
          <div className="cols2 ec-cols">
            <div>{list}</div>
            <div className="ec-stick">{side}</div>
          </div>
        ) : (
          <>
            {list}
            {side}
          </>
        )}
        <div className="end" />
      </div>
    </Screen>
  );
}

/** Une prestation : son prix, ce qu'elle a rapporté, et sa barre (fait plein, prévu hachuré). */
function Row({ s, max, open, onToggle, onPlan }: { s: Stat; max: number; open: boolean; onToggle: () => void; onPlan: () => void }) {
  const st = useDataStore.getState;
  const say = useUiStore((x) => x.say);
  const { p } = s;
  const upd = (patch: Partial<Prestation>) => st().updatePrestation(p.id, patch);
  const dw = (s.done / max) * 100;
  const pw = (s.planned / max) * 100;
  return (
    <div className={`ec-pr${p.active ? "" : " off"}`}>
      <button type="button" className="sum" onClick={onToggle} aria-expanded={open}>
        <span>
          <b>
            {p.label}
            {!p.active && <span className="pill">en pause</span>}
          </b>
          <small>
            {p.price > 0 ? `${eur(p.price)} ${p.hasFormat ? "par cavalier · seul ou en groupe" : "la séance"}` : `Pas de prix pour l’instant${p.hasFormat ? " · seul ou en groupe" : ""}`}
          </small>
          <small>{s.count ? `${s.count} séance${s.count > 1 ? "s" : ""}, ${s.riders} cavalier${s.riders > 1 ? "s" : ""}` : "rien ce mois-ci"}</small>
        </span>
        <span className="am">
          {s.done > 0 ? <b className="in">{sg(s.done)}</b> : <b>0 €</b>}
          {s.planned > 0 && (
            <small>
              {sg(s.planned)}
              <br />
              encore prévus
            </small>
          )}
        </span>
      </button>
      <div className="bar" aria-hidden>
        {s.done > 0 && <i style={{ width: `${dw}%` }} />}
        {s.planned > 0 && <i className="plan" style={{ left: `${dw}%`, width: `${pw}%` }} />}
      </div>

      {open && (
        <div className="ed">
          <label className="lrow">
            <span>Nom</span>
            <span className="input">
              <input defaultValue={p.label} onChange={(e) => e.target.value.trim() && upd({ label: e.target.value.trim() })} />
            </span>
          </label>
          <label className="lrow">
            <span>Prix</span>
            <span className="input">
              <input inputMode="decimal" defaultValue={montantEnTexte(p.price)} placeholder="Ajouter un prix" aria-label={`Prix de ${p.label}`} style={{ fontWeight: 600 }} onChange={(e) => lireMontant(e.target.value) !== null && upd({ price: montantOuZero(e.target.value) })} />
              <span className="u">€</span>
            </span>
          </label>
          <Switch on={!!p.hasFormat} onClick={() => upd({ hasFormat: !p.hasFormat })}>
            Cours seul ou en groupe (prix par cavalier)
          </Switch>
          <div className="acts">
            {p.active && (
              <button type="button" className="lnk" onClick={onPlan}>
                Planifier une séance
              </button>
            )}
            <button type="button" className="lnk mute" onClick={() => upd({ active: !p.active })}>
              {p.active ? "Mettre en pause" : "Reprendre"}
            </button>
            <button
              type="button"
              className="lnk mute"
              onClick={() => {
                const snap = st().prestations;
                const r = st().removePrestation(p.id);
                say(
                  r === "supprimee" ? `Retiré : ${esc(p.label)}.` : `${esc(p.label)} a déjà des séances. On la met en pause pour garder ton historique.`,
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
  const n = montantOuZero(price);
  const ok = label.trim().length > 1 && n > 0;
  function add() {
    if (!ok) return;
    useDataStore.getState().addPrestation({ label: label.trim(), price: n, hasFormat: fmt });
    say(`Ajouté : <strong>${esc(label.trim())}</strong> à ${eur(n)}.`);
    setLabel("");
    setPrice("");
    setFmt(false);
  }
  return (
    <>
      <div className="ec-stk">
        <label className="field">
          <span>Nom</span>
          <span className="input">
            <input placeholder="Ex. Longe, transport concours" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          </span>
        </label>
        <label className="field">
          <span>Prix</span>
          <span className="input">
            <input inputMode="decimal" placeholder="0" value={price} onChange={(e) => setPrice(saisieMontant(e.target.value))} onKeyDown={(e) => e.key === "Enter" && add()} style={{ fontWeight: 600 }} />
            <span className="u">€</span>
          </span>
        </label>
      </div>
      <div className="ec-sw">
        <Switch on={fmt} onClick={() => setFmt(!fmt)}>
          Cours seul ou en groupe (prix par cavalier)
        </Switch>
      </div>
      <button type="button" className="btn full" style={{ marginTop: 12 }} onClick={add} disabled={!ok}>
        <Ic n="plus" className="" />
        Ajouter
      </button>
    </>
  );
}
