"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClientGate } from "@/components/ui/client-gate";
import { Check, Over, Screen, Sec, cap, eur, signed, withBase } from "@/components/bs/ui";
import { CARE_PICTO, Picto } from "@/components/bs/picto";
import { HorseFace } from "@/components/bs/horse-face";
import { OBSTACLE_META, useParcours } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { agendaSessions, upcomingDeadlines, CARE_META, type Session } from "@/lib/domain/care";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";

/**
 * Aujourd'hui : le carnet du jour. Une tâche par ligne, une coche. Cocher
 * range l'argent au bon cheval (recette d'un cours, coût d'un soin). Ce qui
 * est en retard se règle en notant l'acte ; demain se voit venir.
 */
export default function Page() {
  return (
    <ClientGate>
      <Aujourdhui />
    </ClientGate>
  );
}

function Aujourdhui() {
  const data = useDataStore();
  const gerant = useSettingsStore((s) => s.gerant);
  const openNoter = useUiStore((s) => s.openNoter);
  const say = useUiStore((s) => s.say);
  const { current, n, pass, parcours } = useParcours();
  const [open, setOpen] = useState<string | null>(null);
  const [absent, setAbsent] = useState<Record<string, boolean>>({});

  const today = localToday();
  const nameOf = (id: string) => data.horses.find((h) => h.id === id)?.name ?? "";
  const sessions = agendaSessions(data, today);
  const todays = sessions.filter((s) => s.daysUntil <= 0);
  const tomorrow = sessions.filter((s) => s.daysUntil === 1);
  const overdue = upcomingDeadlines(data, today).filter((d) => d.status === "overdue" && !d.plannedFor);
  const doneToday = (data.careEvents ?? []).filter((e) => !e.pending && e.date === today);
  const m = useMemo(() => monthBreakdown(data, currentPeriod()), [data]);

  const doneGroups = useMemo(() => {
    const map = new Map<string, typeof doneToday>();
    for (const e of doneToday) {
      const k = e.groupId ?? e.id;
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return [...map.values()];
  }, [doneToday]);

  function confirm(s: Session) {
    const st = useDataStore.getState();
    const snapshot = { careEvents: st.careEvents, directExpenses: st.directExpenses, revenues: st.revenues };
    const present = s.events.filter((e) => !absent[e.id]).map((e) => e.horseId);
    st.confirmSession(s.events.map((e) => e.id), present, today);
    const money = s.events.filter((e) => !absent[e.id]).reduce((t, e) => t + (e.revenue ?? 0) - (e.cost ?? 0), 0);
    const who = present.length === 1 ? `au <a href="${withBase(`/ticket?id=${present[0]}`)}">ticket de ${nameOf(present[0])}</a>` : `aux tickets de ${present.length} chevaux`;
    say(
      money ? `${CARE_META[s.kind].label} : <strong>${signed(money)}</strong> ajouté ${who}.` : `${CARE_META[s.kind].label} : fait.`,
      () => useDataStore.setState(snapshot),
    );
    setOpen(null);
    setAbsent({});
    const after = (useDataStore.getState().careEvents ?? []).filter((e) => !e.pending && e.date === today).length;
    if (after >= 3 && parcours.chevaux && parcours.tarifs && parcours.factures) setTimeout(() => pass("journee"), 1200);
  }

  const sessionTitle = (s: Session) => {
    const names = s.events.map((e) => nameOf(e.horseId));
    const what = CARE_META[s.kind].label;
    return `${what} · ${names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ")}`;
  };
  const sessionSub = (s: Session) => {
    const bits = [s.label, s.provider].filter(Boolean) as string[];
    const rev = s.events.reduce((t, e) => t + (e.revenue ?? 0), 0);
    const cost = s.events.reduce((t, e) => t + (e.cost ?? 0), 0);
    if (rev) bits.push(`+${eur(rev)}`);
    if (cost) bits.push(eur(cost));
    if (s.daysUntil < 0) bits.unshift(`à confirmer, il y a ${-s.daysUntil} j`);
    return bits.join(" · ");
  };

  const left = todays.length + overdue.length;

  return (
    <Screen>
      <Over left={cap(new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }))} right={<span className="bs-wm">be stable</span>} />
      <h1 className="bs-d bs-t1">Bonjour {gerant}</h1>
      <p className="bs-p">
        {left ? `${left} chose${left > 1 ? "s" : ""} à faire aujourd’hui.` : "Rien à confirmer aujourd’hui."} Une coche range l’argent au bon cheval.
      </p>

      <Sec action={<Link href="/planning">Toute la semaine</Link>}>Aujourd’hui</Sec>
      {todays.length === 0 && doneGroups.length === 0 && (
        <button type="button" className="bs-li tap" onClick={() => openNoter({})}>
          <span className="bs-pic soft">
            <Picto name="plus" />
          </span>
          <span className="tx">
            <b>Note ce que tu fais aujourd’hui</b>
            <span>un soin, un cours, une facture, ou planifie la semaine</span>
          </span>
        </button>
      )}
      {todays.map((s) => (
        <div key={s.key}>
          <div className="bs-li">
            <span className={`bs-pic ${s.events.some((e) => e.cost) ? "rose" : ""}`}>
              <Picto name={CARE_PICTO[s.kind]} />
            </span>
            <button type="button" className="tx" style={{ textAlign: "left" }} onClick={() => setOpen(open === s.key ? null : s.key)} aria-expanded={open === s.key}>
              <b>{sessionTitle(s)}</b>
              <span className={s.daysUntil < 0 ? "bs-late" : ""}>{sessionSub(s) || (s.events.length > 1 ? "touche pour les présences" : "")}</span>
            </button>
            <Check on={false} onClick={() => confirm(s)} label={`Fait : ${sessionTitle(s)}`} />
          </div>
          {open === s.key && s.events.length > 1 && (
            <div style={{ padding: "8px 0 14px", borderBottom: "1px solid var(--line-2)" }}>
              <p className="bs-p" style={{ marginTop: 0 }}>Qui était là ? Touche un cheval absent.</p>
              <div className="bs-faces">
                {s.events.map((e) => (
                  <button key={e.id} type="button" className="bs-fpick" aria-pressed={!absent[e.id]} onClick={() => setAbsent({ ...absent, [e.id]: !absent[e.id] })}>
                    <span className="ring" style={{ opacity: absent[e.id] ? 0.35 : 1 }}>
                      <HorseFace horse={data.horses.find((h) => h.id === e.horseId)} size={40} />
                    </span>
                    {nameOf(e.horseId)}
                  </button>
                ))}
              </div>
              <button type="button" className="bs-btn" style={{ marginTop: 12 }} onClick={() => confirm(s)}>
                Valider les présences
              </button>
            </div>
          )}
        </div>
      ))}
      {doneGroups.map((g) => (
        <div key={g[0].id} className="bs-li done">
          <span className="bs-pic">
            <Picto name={CARE_PICTO[g[0].kind]} />
          </span>
          <span className="tx">
            <b>
              {CARE_META[g[0].kind].label} · {g.map((e) => nameOf(e.horseId)).join(", ")}
            </b>
            <span className="bs-when">fait aujourd’hui</span>
          </span>
          <span className="bs-ck on" style={{ pointerEvents: "none" }}>
            <i>
              <Picto name="check" />
            </i>
          </span>
        </div>
      ))}

      {overdue.length > 0 && (
        <>
          <Sec>En retard</Sec>
          {overdue.slice(0, 5).map((d) => (
            <div key={`${d.horseId}-${d.kind}`} className="bs-li">
              <span className="bs-pic rose">
                <Picto name={CARE_PICTO[d.kind]} />
              </span>
              <span className="tx">
                <b>
                  {CARE_META[d.kind].label} · {nameOf(d.horseId)}
                </b>
                <span className="bs-late">en retard de {-d.daysLeft} j</span>
              </span>
              <Check on={false} onClick={() => openNoter({ kind: d.kind, horseIds: [d.horseId] })} label={`Noter ${CARE_META[d.kind].label} pour ${nameOf(d.horseId)}`} />
            </div>
          ))}
        </>
      )}

      {tomorrow.length > 0 && (
        <>
          <Sec>Demain</Sec>
          {tomorrow.map((s) => (
            <div key={s.key} className="bs-li">
              <span className="bs-pic">
                <Picto name={CARE_PICTO[s.kind]} />
              </span>
              <span className="tx">
                <b>{sessionTitle(s)}</b>
                <span>{sessionSub(s)}</span>
              </span>
            </div>
          ))}
        </>
      )}

      {current ? (
        <Link href="/parcours" className="bs-card">
          <span className="bs-pic soft">
            <Picto name="flag" />
          </span>
          <div style={{ flex: 1 }}>
            <div className="k">Ton parcours · {n} sur 6</div>
            <b>Prochain obstacle : {OBSTACLE_META[current].title.toLowerCase()}</b>
          </div>
          <Picto name="arrowR" />
        </Link>
      ) : (
        <Link href="/mois" className="bs-card">
          <span className="bs-pic soft">
            <Picto name="euro" />
          </span>
          <div style={{ flex: 1 }}>
            <div className="k">Ce mois, ton écurie {m.net >= 0 ? "a gagné" : "a perdu"}</div>
            <div className={`bs-big${m.net < 0 ? " neg" : ""}`}>{signed(m.net)}</div>
          </div>
          <Picto name="arrowR" />
        </Link>
      )}
    </Screen>
  );
}
