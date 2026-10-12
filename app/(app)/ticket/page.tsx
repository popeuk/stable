"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Back, Screen, Sec, Tip, eur, signed } from "@/components/bs/ui";
import { CARE_PICTO, Picto, pictoForLabel } from "@/components/bs/picto";
import { HorseFace } from "@/components/bs/horse-face";
import { useDesk } from "@/components/bs/desk";
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
  if (t.net >= 0) return `${h.name} paie ses soins et sa part des frais communs. Une fois tout payé, il te laisse ${eur(t.net)} ce mois.`;
  const soins = t.lines.filter((l) => l.kind === "out" && /orthop|ost|compl|dent|vaccin|vermif/i.test(l.label));
  const big = (soins.length ? soins : t.lines.filter((l) => l.kind === "out")).sort((a, b) => a.amount - b.amount)[0];
  if (big && -big.amount > 20)
    return `Sa pension ne suffit pas à payer ses soins. Si tu fais payer « ${big.label.toLowerCase()} »${h.ownerName ? ` à ${h.ownerName}` : " à son propriétaire"}, il te laisserait ${signed(t.net - big.amount)}.`;
  const breakeven = Math.ceil((t.direct + t.share - (t.revenue - (h.pension ?? 0))) / 10) * 10;
  return `Sa pension (${eur(h.pension ?? 0)}) est plus basse que ce qu’il te coûte. À ${eur(breakeven)} par mois, tu ne perdrais plus d’argent avec lui.`;
}

function Ticket({ horse }: { horse: Horse }) {
  const router = useRouter();
  const data = useDataStore();
  const archiveHorse = useDataStore((s) => s.archiveHorse);
  const openNoter = useUiStore((s) => s.openNoter);
  const lastLine = useUiStore((s) => s.lastLine);
  const { pass, setupDone, parcours } = useParcours();
  const [offset, setOffset] = useState(0);
  const [seg, setSeg] = useState<"ticket" | "carnet" | "planning">("ticket");
  const desk = useDesk();
  const say = useUiStore((s) => s.say);
  const openSeance = useUiStore((s) => s.openSeance);
  const period = useMemo(() => addMonths(currentPeriod(), offset), [offset]);
  const t = useMemo(() => horseTicket(data, horse.id, period), [data, horse.id, period]);
  const nets = useMemo(() => reconciledNets(data, period), [data, period]);
  const net = nets[horse.id] ?? Math.round(t.net);
  const today = localToday();
  const log = horseCareLog(data, horse.id, today).slice(0, 6);
  const due = upcomingDeadlines(data, today).filter((d) => d.horseId === horse.id && d.status !== "ok");
  const monthName = new Date(period.year, period.month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: offset ? "numeric" : undefined });

  // Le plus gros frais du mois pas encore refacturé au propriétaire.
  const rebill = data.directExpenses
    .filter((e) => e.horseId === horse.id && !e.rebillRevenueId && e.date.startsWith(`${period.year}-${String(period.month).padStart(2, "0")}`) && e.amount > 20)
    .sort((a, b) => b.amount - a.amount)[0];
  const seances = (data.seances ?? [])
    .filter((x) => x.horseIds.includes(horse.id) && x.status !== "cancelled" && x.date >= today)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .slice(0, 12);

  useEffect(() => {
    if (setupDone && !parcours.ticket) pass("ticket");
  }, [setupDone, parcours.ticket, pass]);

  return (
    <Screen wide={desk}>
      <Back href="/chevaux">Mes chevaux</Back>
      {desk && <HorseStrip current={horse.id} nets={nets} />}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: desk ? 14 : 6 }}>
        <HorseFace horse={horse} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="bs-d bs-t2">Le ticket de {horse.name}</h1>
          <p className="bs-p" style={{ marginTop: 2 }}>Son ticket : ce qu’il rapporte et ce qu’il coûte ce mois.</p>
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

      {!desk && (
      <div className="bs-seg">
        {(
          [
            ["ticket", "Ticket"],
            ["carnet", "Carnet"],
            ["planning", "Planning"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={seg === k} onClick={() => setSeg(k)}>
            {l}
          </button>
        ))}
      </div>
      )}

      <div className={desk ? "bs-split wide-l" : undefined}>
      <div>
      {(desk || seg === "ticket") && (
      <>
      <div className="bs-ticket" style={{ marginTop: 10 }}>
        {t.lines.length === 0 && <p className="bs-p">Rien de noté ce mois-ci. Ajoute sa pension ou un soin pour voir son ticket.</p>}
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
          <span>{net >= 0 ? "Il te laisse" : "Il te coûte"}</span>
          <span className="bs-big">{signed(net)}</span>
        </div>
      </div>

      {offset === 0 && t.lines.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <Tip>{tipFor(horse, t)}</Tip>
          {net < 0 && rebill && (
            <button
              type="button"
              className="bs-btn"
              style={{ marginTop: 10 }}
              onClick={() => {
                const st = useDataStore.getState();
                const snap = { revenues: st.revenues, directExpenses: st.directExpenses };
                st.rebillExpense(rebill.id);
                say(`« ${rebill.label} » ajouté à ce que doit payer ${horse.ownerName || "son propriétaire"} : <strong>+${eur(rebill.amount)}</strong>.`, () => useDataStore.setState(snap));
              }}
            >
              Faire payer « {rebill.label.toLowerCase()} » au propriétaire · +{eur(rebill.amount)}
            </button>
          )}
        </div>
      )}

      <button type="button" className="bs-btn line" style={{ marginTop: 16 }} onClick={() => openNoter({ horseIds: [horse.id] })}>
        <Picto name="plus" />
        Noter quelque chose pour {horse.name}
      </button>

      </>
      )}
      </div>

      <div className={desk ? "stick" : undefined}>
      {(desk || seg === "carnet") && due.length > 0 && desk && (
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
      {(desk || seg === "planning") && (
        <>
          <Sec>À venir</Sec>
          {seances.length === 0 && <p className="bs-p">Aucune séance prévue pour {horse.name}. Ajoute un cours ou une sortie ci-dessous.</p>}
          {seances.map((x) => (
            <button key={x.id} type="button" className="bs-li tap" onClick={() => openSeance(x.id)}>
              <span className="bs-pic">
                <Picto name="cours" />
              </span>
              <span className="tx">
                <b>{x.title}</b>
                <span>
                  {new Date(x.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · {x.start}
                </span>
              </span>
              <Picto name="chev" />
            </button>
          ))}
          <button type="button" className="bs-btn line" style={{ marginTop: 16 }} onClick={() => openNoter({ mode: "seance", horseIds: [horse.id] })}>
            <Picto name="plus" />
            Planifier une séance
          </button>
        </>
      )}

      {(desk || seg === "carnet") && (
      <>
      {!desk && due.length > 0 && (
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
      {log.length === 0 && <p className="bs-p">Rien de noté pour l’instant. Ses soins (vaccin, maréchal, dentiste…) apparaîtront ici.</p>}
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
      </>
      )}
      </div>
      </div>

      <button
        type="button"
        className="bs-back"
        style={{ marginTop: 24, color: "var(--rose-ink)" }}
        onClick={() => {
          if (window.confirm(`${horse.name} quitte l’écurie ? Ce qu’il a rapporté et coûté reste visible dans les mois passés.`)) {
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

/** Ordinateur : tous les chevaux en bandeau, pour passer d'un ticket à l'autre. */
function HorseStrip({ current, nets }: { current: string; nets: Record<string, number> }) {
  const horses = useDataStore((s) => s.horses);
  return (
    <nav className="bs-hstrip" aria-label="Changer de cheval">
      {horses
        .filter((h) => !h.isArchived)
        .map((h) => (
          <Link key={h.id} href={`/ticket?id=${h.id}`} aria-current={h.id === current ? "page" : undefined}>
            <HorseFace horse={h} size={36} />
            {h.name}
            <i style={{ color: (nets[h.id] ?? 0) >= 0 ? "var(--vert)" : "var(--rose-ink)" }}>{signed(nets[h.id] ?? 0)}</i>
          </Link>
        ))}
    </nav>
  );
}
