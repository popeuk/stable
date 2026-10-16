"use client";

import { useMemo } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Back, Screen, signed, esc } from "@/components/bs/ui";
import { CountUp, Hello, Ic, Ill, Sec, type IllName } from "@/components/carnet/ui";
import { DayBlock } from "@/components/bs/day-block";
import { ListePaniers, usePaniers } from "@/components/bs/paniers";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { toValidate } from "@/lib/domain/seances";
import { addDays } from "@/components/bs/dates";
import { localToday } from "@/lib/utils/local-date";

/**
 * À valider : en tête, les paniers de tes clients (ce qui a eu lieu pour
 * eux, validé d'un geste). Dessous, ce qui reste à confirmer sans client,
 * du plus ancien au plus récent. Valider met l'argent sur les tickets.
 * Style : app/carnet/journee.css.
 */
export default function Page() {
  return (
    <ClientGate>
      <Valider />
    </ClientGate>
  );
}

const hhmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const VIGNETTES: IllName[] = ["confirmer", "gerant-buste", "foin", "gerant-foin"];

function Valider() {
  const data = useDataStore();
  const say = useUiStore((s) => s.say);
  const today = localToday();
  const { paniers, count, total: aValider } = usePaniers();
  // Ce qui est déjà dans un panier se valide là-haut : on ne le montre pas deux fois.
  const items = useMemo(() => {
    const keys = new Set<string>();
    for (const p of paniers)
      for (const l of p.lignes) {
        keys.add(l.itemKey);
        if (l.seanceId) keys.add(`seance:${l.seanceId}`);
        for (const c of l.careIds ?? []) keys.add(`care:${c}`);
      }
    return toValidate(data, today, hhmm()).filter((it) => !keys.has(it.key) && !(it.seance && keys.has(`seance:${it.seance.id}`)) && !(it.care ?? []).some((c) => keys.has(`care:${c.id}`)));
  }, [data, today, paniers]);
  const total = items.reduce((t, i) => t + (i.money ?? 0), 0);
  const simple = items.filter((i) => !(i.seance && i.seance.participants.length > 1));
  const byDate = new Map<string, typeof items>();
  for (const it of items) {
    const d = it.seance?.date ?? it.care?.[0].date ?? today;
    byDate.set(d, [...(byDate.get(d) ?? []), it]);
  }
  const dayTitle = (d: string) => {
    const long = new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" });
    if (d === today) return `Aujourd’hui, ${long}`;
    if (d === addDays(today, -1)) return `Hier, ${long}`;
    const s = new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  function validateSimple() {
    const st = useDataStore.getState();
    const snap = { seances: st.seances, careEvents: st.careEvents, directExpenses: st.directExpenses, revenues: st.revenues };
    let money = 0;
    for (const it of simple) {
      if (it.seance) st.validateSeance(it.seance.id, {});
      else if (it.care) st.confirmSession(it.care.map((e) => e.id), it.care.map((e) => e.horseId), it.care[0].date);
      money += it.money ?? 0;
    }
    say(`C’est fait pour ${simple.length} : <strong>${esc(signed(money))}</strong> comptés sur les tickets des chevaux.`, () => useDataStore.setState(snap));
  }

  return (
    <Screen>
      <Back href="/planning">Planning</Back>
      <div className="jr-valider">
        <Hello title="À valider." sub="D’abord les paniers de tes clients : ce qui a eu lieu pour eux. Valide, et ça devient ce qu’ils te doivent. Dessous, ce qui reste à confirmer sans client." />
        <Sec blk ill="carnet-buste" title="Les paniers de tes clients" delay={0.08}>
          {count > 0 && (
            <p className="note jr-pcnt">
              {count} client{count > 1 ? "s" : ""} · <span className="in">{signed(aValider)}</span> à valider
            </p>
          )}
          <ListePaniers />
        </Sec>
        <h2 className="jr-h2 rise" style={{ animationDelay: ".14s" }}>
          Sans client
        </h2>
        <div className="pad rise" style={{ animationDelay: ".16s", marginTop: 8 }}>
          <div className="card jr-wait">
            <span>
              <span className="k">En attente de ta coche</span>
              <b className={`mid ${items.length && total ? (total > 0 ? "in" : "out") : "jr-zero"}`}>{items.length ? <CountUp value={total} /> : "0 €"}</b>
            </span>
            <span className={`pill${items.length ? " ink" : ""}`}>{items.length ? `${items.length} à confirmer` : "tout est à jour"}</span>
          </div>
        </div>
        {items.length === 0 && (
          <div className="empty rise" style={{ animationDelay: ".22s" }}>
            <Ill n="gerant-rosette" className="jr-rosette" alt="Le gérant brandit une rosette." />
            <p style={{ margin: 0 }}>
              <b className="jr-ok">Rien d’autre à confirmer.</b>
              <br />
              Tout ce qui a eu lieu sans client est compté.
            </p>
          </div>
        )}
        {[...byDate.entries()].map(([d, its], i) => (
          <Sec key={d} blk ill={VIGNETTES[i % VIGNETTES.length]} title={dayTitle(d)} delay={0.2 + i * 0.08}>
            <div className="rows">
              {its.map((it) => (
                <DayBlock key={it.key} it={it} />
              ))}
            </div>
          </Sec>
        ))}
        {items.length > 0 && (
          <div className="pad rise" style={{ animationDelay: ".3s", marginTop: 14 }}>
            {simple.length > 0 && (
              <button type="button" className="btn full" onClick={validateSimple}>
                <Ic n="ck" className="" />
                {simple.length === items.length ? `Tout confirmer (${simple.length})` : `Confirmer les ${simple.length} autres d’un coup`}
              </button>
            )}
            {items.length > simple.length && (
              <p className="note" style={{ textAlign: "center" }}>
                Pour les cours à plusieurs, touche leur coche pour dire qui était là.
              </p>
            )}
          </div>
        )}
        <div className="end" />
      </div>
    </Screen>
  );
}
