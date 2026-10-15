"use client";

import { useMemo } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Back, Screen, signed, esc } from "@/components/bs/ui";
import { CountUp, Hello, Ic, Ill, Sec, type IllName } from "@/components/carnet/ui";
import { DayBlock } from "@/components/bs/day-block";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { toValidate } from "@/lib/domain/seances";
import { addDays } from "@/components/bs/dates";
import { localToday } from "@/lib/utils/local-date";

/**
 * À valider : les séances et soins passés, pas encore validés, du plus
 * ancien au plus récent. Valider met l'argent sur les tickets.
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
const VIGNETTES: IllName[] = ["confirmer", "carnet-buste", "brouette", "foin"];

function Valider() {
  const data = useDataStore();
  const say = useUiStore((s) => s.say);
  const today = localToday();
  const items = useMemo(() => toValidate(data, today, hhmm()), [data, today]);
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
        <Hello title="À confirmer." sub="Les séances et les soins déjà passés. Coche ce qui a bien eu lieu, l’argent est alors compté sur le ticket de chaque cheval." />
        <div className="pad rise" style={{ animationDelay: ".12s", marginTop: 16 }}>
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
            <Ill n="rosette" className="jr-rosette" alt="La gérante brandit une rosette." />
            <p style={{ margin: 0 }}>
              <b className="jr-ok">Planning à jour.</b>
              <br />
              Tout ce qui a eu lieu est compté.
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
