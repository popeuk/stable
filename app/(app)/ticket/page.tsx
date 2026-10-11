"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Back, Screen, Sec, Tip, eur, signed } from "@/components/bs/ui";
import { CARE_PICTO, Picto, pictoForLabel } from "@/components/bs/picto";
import { HorseFace } from "@/components/bs/horse-face";
import { useParcours } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { horseTicket, reconciledNets, type HorseTicket } from "@/lib/domain/ticket";
import { CARE_META, horseCareLog, upcomingDeadlines } from "@/lib/domain/care";
import { currentPeriod, addMonths } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";
import type { Horse } from "@/lib/domain/types";

/**
 * Le ticket du mois d'un cheval : ce qui est entré, ce qui est sorti, sa
 * part de l'écurie, le total. Puis une idée concrète, et son carnet.
 */
export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <TicketRoute />
      </Suspense>
    </ClientGate>
  );
}

function TicketRoute() {
  const id = useSearchParams().get("id");
  const horse = useDataStore((s) => s.horses.find((h) => h.id === id));
  if (!id || !horse) {
    return (
      <Screen>
        <Back href="/chevaux">Mes chevaux</Back>
        <p className="bs-p">Ce cheval n’est plus dans l’écurie.</p>
      </Screen>
    );
  }
  return <Ticket horse={horse} />;
}

function tipFor(h: Horse, t: HorseTicket): string {
  if (t.net >= 0) return `${h.name} paie ses soins et sa part de l’écurie. Il te laisse ${eur(t.net)} ce mois.`;
  const soins = t.lines.filter((l) => l.kind === "out" && /orthop|ost|compl|dent|vaccin|vermif/i.test(l.label));
  const big = (soins.length ? soins : t.lines.filter((l) => l.kind === "out")).sort((a, b) => a.amount - b.amount)[0];
  if (big && -big.amount > 20)
    return `Sa pension ne couvre pas ses soins. Refacturer « ${big.label.toLowerCase()} »${h.ownerName ? ` à ${h.ownerName}` : " à son propriétaire"} le ramènerait à ${signed(t.net - big.amount)}.`;
  const breakeven = Math.ceil((t.direct + t.share - (t.revenue - (h.pension ?? 0))) / 10) * 10;
  return `Sa pension (${eur(h.pension ?? 0)}) est sous ce qu’il coûte. Une pension à ${eur(breakeven)} le mettrait à l’équilibre.`;
}

function Ticket({ horse }: { horse: Horse }) {
  const router = useRouter();
  const data = useDataStore();
  const archiveHorse = useDataStore((s) => s.archiveHorse);
  const openNoter = useUiStore((s) => s.openNoter);
  const lastLine = useUiStore((s) => s.lastLine);
  const { pass, setupDone, parcours } = useParcours();
  const [offset, setOffset] = useState(0);
  const period = useMemo(() => addMonths(currentPeriod(), offset), [offset]);
  const t = useMemo(() => horseTicket(data, horse.id, period), [data, horse.id, period]);
  const nets = useMemo(() => reconciledNets(data, period), [data, period]);
  const net = nets[horse.id] ?? Math.round(t.net);
  const today = localToday();
  const log = horseCareLog(data, horse.id, today).slice(0, 6);
  const due = upcomingDeadlines(data, today).filter((d) => d.horseId === horse.id && d.status !== "ok");
  const monthName = new Date(period.year, period.month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: offset ? "numeric" : undefined });

  useEffect(() => {
    if (setupDone && !parcours.ticket) pass("ticket");
  }, [setupDone, parcours.ticket, pass]);

  return (
    <Screen>
      <Back href="/chevaux">Mes chevaux</Back>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
        <HorseFace horse={horse} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="bs-d bs-t2">Le ticket de {horse.name}</h1>
          <p className="bs-p" style={{ marginTop: 2 }}>
            {[horse.pensionType, horse.ownerName && `propriétaire ${horse.ownerName}`].filter(Boolean).join(" · ") || "pension"}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
        <button type="button" className="bs-back" onClick={() => setOffset(offset - 1)} aria-label="Mois précédent">
          <Picto name="chevL" />
        </button>
        <span style={{ fontSize: 13.5, fontWeight: 560 }}>{monthName}</span>
        <button type="button" className="bs-back" onClick={() => setOffset(Math.min(0, offset + 1))} disabled={offset === 0} aria-label="Mois suivant" style={{ opacity: offset === 0 ? 0.3 : 1 }}>
          <Picto name="chev" />
        </button>
      </div>

      <div className="bs-ticket" style={{ marginTop: 6 }}>
        {t.lines.length === 0 && <p className="bs-p">Rien ce mois-ci pour l’instant.</p>}
        {t.lines.map((l) => (
          <div key={l.key} className={`bs-tl${lastLine && lastLine.horseId === horse.id && lastLine.sourceId === l.sourceId ? " new" : ""}`}>
            <Picto name={pictoForLabel(l.label)} />
            <span>
              {l.kind === "share" ? (
                <Link href={`/part?id=${horse.id}`} className="bs-lnk">
                  {l.label}
                </Link>
              ) : (
                l.label
              )}
              {l.date && <small>{new Date(l.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</small>}
            </span>
            <b>{signed(l.amount)}</b>
          </div>
        ))}
        <div className="bs-tot">
          <span>{net >= 0 ? "Il te reste" : "Il te coûte"}</span>
          <span className="bs-big">{signed(net)}</span>
        </div>
      </div>

      {offset === 0 && t.lines.length > 0 && <div style={{ marginTop: 22 }}><Tip>{tipFor(horse, t)}</Tip></div>}

      <button type="button" className="bs-btn line" style={{ marginTop: 16 }} onClick={() => openNoter({ horseIds: [horse.id] })}>
        <Picto name="plus" />
        Noter pour {horse.name}
      </button>

      {due.length > 0 && (
        <>
          <Sec>À prévoir</Sec>
          {due.map((d) => (
            <button key={d.kind} type="button" className="bs-li tap" onClick={() => openNoter({ kind: d.kind, horseIds: [horse.id] })}>
              <span className={`bs-pic ${d.status === "overdue" ? "rose" : ""}`}>
                <Picto name={CARE_PICTO[d.kind]} />
              </span>
              <span className="tx">
                <b>{CARE_META[d.kind].label}</b>
                <span className={d.status === "overdue" ? "bs-late" : ""}>{d.daysLeft < 0 ? `en retard de ${-d.daysLeft} j` : d.daysLeft === 0 ? "aujourd’hui" : `dans ${d.daysLeft} j`}</span>
              </span>
              <Picto name="chev" />
            </button>
          ))}
        </>
      )}

      <Sec>Son carnet</Sec>
      {log.length === 0 && <p className="bs-p">Rien de noté pour l’instant.</p>}
      {log.map((e) => (
        <div key={e.id} className="bs-li">
          <span className="bs-pic">
            <Picto name={CARE_PICTO[e.kind]} />
          </span>
          <span className="tx">
            <b>{e.label ? `${CARE_META[e.kind].label} · ${e.label}` : CARE_META[e.kind].label}</b>
            <span>
              {new Date(e.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
              {e.provider ? ` · ${e.provider}` : ""}
            </span>
          </span>
          {e.cost ? <span className="bs-amt">{signed(-e.cost)}</span> : e.revenue ? <span className="bs-amt plus">{signed(e.revenue)}</span> : null}
        </div>
      ))}

      <button
        type="button"
        className="bs-back"
        style={{ marginTop: 24, color: "var(--rose-ink)" }}
        onClick={() => {
          if (window.confirm(`${horse.name} quitte l’écurie ? Son historique reste dans les mois passés.`)) {
            archiveHorse(horse.id);
            router.push("/chevaux");
          }
        }}
      >
        {horse.name} quitte l’écurie
      </button>
    </Screen>
  );
}
