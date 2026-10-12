"use client";

import { useMemo } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Back, Screen, Sec, signed, esc } from "@/components/bs/ui";
import { DayBlock } from "@/components/bs/day-block";
import { Rosette } from "@/components/bs/ui";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { toValidate } from "@/lib/domain/seances";
import { localToday } from "@/lib/utils/local-date";

/**
 * À valider : les séances et soins passés, pas encore validés, du plus
 * ancien au plus récent. Valider met l'argent sur les tickets.
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
      <h1 className="bs-d bs-t1">À confirmer</h1>
      <p className="bs-p">Les séances et les soins déjà passés. Coche ce qui a bien eu lieu. L’argent est alors compté sur le ticket de chaque cheval.</p>
      <div className="bs-card" style={{ justifyContent: "space-between" }}>
        <span>
          <span className="k">En attente de ta coche</span>
          <br />
          <b className="bs-big" style={{ fontSize: 24, color: items.length ? "var(--vert)" : "var(--ink-3)" }}>
            {signed(total)}
          </b>
        </span>
        <span className={`bs-pill ${items.length ? "r" : "g"}`}>{items.length ? `${items.length} à confirmer` : "tout est à jour"}</span>
      </div>
      {items.length === 0 && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 26 }}>
          <Rosette lines={["Planning", "à jour"]} size={96} />
        </div>
      )}
      {[...byDate.entries()].map(([d, its]) => (
        <div key={d}>
          <Sec>{new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</Sec>
          {its.map((it) => (
            <DayBlock key={it.key} it={it} />
          ))}
        </div>
      ))}
      {simple.length > 0 && (
        <button type="button" className="bs-btn" style={{ marginTop: 16 }} onClick={validateSimple}>
          {simple.length === items.length ? `Tout confirmer (${simple.length})` : `Confirmer les ${simple.length} autres d’un coup`}
        </button>
      )}
      {items.length > simple.length && <p className="bs-p" style={{ textAlign: "center", marginTop: 8 }}>Pour les cours à plusieurs, touche leur coche pour dire qui était là.</p>}
    </Screen>
  );
}
