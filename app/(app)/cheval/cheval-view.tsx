"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ClientGate } from "@/components/ui/client-gate";
import { Sparkline } from "@/components/ui/sparkline";
import { Explain } from "@/components/ed/explain";
import { DeadlineRow, AgendaRow } from "@/components/ed/care-bits";
import { Ic, Money, Page as Ecran, Pill, Portrait, Sec, Tip, eur as eurC } from "@/components/carnet/ui";
import { upcomingDeadlines, plannedEvents, horseCareLog, CARE_META } from "@/lib/domain/care";
import { useHorses } from "@/lib/hooks/use-horses";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { formatEur } from "@/lib/utils/format-currency";
import { dateInPeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";
import { repartition } from "@/lib/domain/presence";

function eur(n: number) {
  const v = new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n))).replace(/\u202f/g, "\u00a0");
  return `${n < 0 ? "−" : ""}${v} €`;
}

function freqLabel(f: string) {
  return f === "monthly" ? "mensuel" : f === "quarterly" ? "trimestriel" : "annuel";
}

const ulReset = { listStyle: "none", margin: 0, padding: 0 } as const;
const trashBtn = { border: 0, background: "none", padding: 4, cursor: "pointer", color: "var(--ink3)" } as const;

export function ChevalView({ id }: { id: string }) {
  return (
    <ClientGate>
      <Cheval id={id} />
    </ClientGate>
  );
}

function Cheval({ id }: { id: string }) {
  const router = useRouter();
  const horses = useHorses(true);
  const data = useDataStore();
  const period = usePeriodStore((s) => s.active);
  const delRecRevenue = useDataStore((s) => s.stopRecurringRevenue);
  const delRecExpense = useDataStore((s) => s.stopRecurringExpense);
  const delRevenue = useDataStore((s) => s.deleteRevenue);
  const delDirect = useDataStore((s) => s.deleteDirectExpense);
  const archiveHorse = useDataStore((s) => s.archiveHorse);

  const idx = horses.findIndex((h) => h.horse.id === id);
  if (idx === -1)
    return (
      <Ecran>
        <p className="note pad">Cheval introuvable.</p>
      </Ecran>
    );

  const recRevenues = (data.recurringRevenues ?? []).filter((r) => r.horseId === id);
  const recExpenses = (data.recurringExpenses ?? []).filter((r) => !r.isShared && r.horseId === id);

  const item = horses[idx];
  const { horse, pnl, trend, series } = item;
  const ok = pnl.netResult >= 0;
  const next = horses[(idx + 1) % horses.length];
  const prev = horses[(idx - 1 + horses.length) % horses.length];
  const cover = pnl.threshold > 0 ? Math.min(1, pnl.revenue / pnl.threshold) : 1;

  const movements = [
    ...data.revenues
      .filter((r) => r.horseId === horse.id && dateInPeriod(r.date, period))
      .map((r) => ({
        id: r.id,
        date: r.date,
        label: data.revenueCategories.find((c) => c.id === r.categoryId)?.name ?? "Revenu",
        amount: r.amount,
        isIn: true,
      })),
    ...data.directExpenses
      .filter((e) => e.horseId === horse.id && dateInPeriod(e.date, period))
      .map((e) => ({ id: e.id, date: e.date, label: e.label, amount: e.amount, isIn: false })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const sharedContrib = data.sharedExpenses
    .filter((s) => s.periodYear === period.year && s.periodMonth === period.month)
    .map((s) => ({ label: s.label, amount: repartition(data, s).find((a) => a.horseId === horse.id)?.allocatedAmount ?? 0 }))
    .filter((x) => x.amount > 0);

  const todayIso = localToday();
  const horseDeadlines = upcomingDeadlines(data, todayIso).filter((d) => d.horseId === horse.id);
  const horseAgenda = plannedEvents(data, todayIso).filter((a) => a.event.horseId === horse.id);
  const careLog = horseCareLog(data, horse.id, todayIso).slice(0, 6);

  return (
    <motion.div
      key={horse.id}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.15}
      onDragEnd={(_, info) => {
        if (info.offset.x < -80) router.push(`/cheval?id=${next.horse.id}`);
        else if (info.offset.x > 80) router.push(`/cheval?id=${prev.horse.id}`);
      }}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <Ecran>
        <div className="pad" style={{ paddingTop: 12 }}>
          <Link href="/ecurie" className="lnk">
            Mon écurie
          </Link>
        </div>

        <Portrait horse={horse} />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Pill tone="ink">{ok ? "Il rapporte" : "Il coûte"}</Pill>
        </div>

        <div className="hello rise" style={{ animationDelay: ".1s" }}>
          <h3>{horse.name}</h3>
          <p>
            {[horse.breed, horse.birthYear ? `${new Date().getFullYear() - horse.birthYear} ans` : "", horse.ownerName].filter(Boolean).join(" · ")}
            {horse.pension ? (
              <>
                <br />
                Pension {new Intl.NumberFormat("fr-FR").format(horse.pension)} €/mois · postée toute seule chaque mois
              </>
            ) : null}
          </p>
          <Link href={`/saisie/cheval?edit=${horse.id}`} aria-label="Modifier" className="lnk ch-edit">
            Modifier
          </Link>
        </div>

        <div className="pad rise" style={{ animationDelay: ".16s", paddingTop: 16, display: "grid", gap: 10 }}>
          <div className="card">
            <Explain k="marge_nette" className="k">
              Ce qu&apos;il te laisse ce mois
            </Explain>
            <p className="big">
              <Money v={pnl.netResult} />
            </p>
            <p className="note">
              <Explain k="tendance">{trend}</Explain>
            </p>
          </div>
          <div className="trio" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <small>Il fait rentrer</small>
              <b>{eur(pnl.revenue)}</b>
            </div>
            <div>
              <Explain k="cout_direct">
                <small>Il te coûte</small>
              </Explain>
              <b>{eur(pnl.threshold)}</b>
            </div>
          </div>
          <div className="card">
            <Explain k="seuil_rentabilite" className="k">
              Son seuil de rentabilité
            </Explain>
            <p className="note">
              Pour être à l&apos;équilibre, il doit rapporter au moins {eur(pnl.threshold)}. Là : {eur(pnl.revenue)}.
            </p>
            <div className="bar">
              <i style={{ width: `${cover * 100}%` }} />
            </div>
          </div>
          <div className="card">
            <p className="k" style={{ marginBottom: 8 }}>
              12 derniers mois
            </p>
            <Sparkline data={series} area width={380} height={72} className="w-full" />
          </div>
          <Tip>
            {ok
              ? `${horse.name} dégage ${eurC(pnl.netResult)} ce mois. Solide, garde le cap.`
              : `${horse.name} te coûte ${eurC(Math.abs(pnl.netResult))} de plus qu’il ne rapporte. Le bon réflexe : alléger ses postes les plus lourds, puis réaligner sa pension à la prochaine échéance, sans geste brusque.`}
          </Tip>
        </div>

        {(horseDeadlines.length > 0 || horseAgenda.length > 0) && (
          <Sec ill="confirmer" title={`À venir pour ${horse.name}`} action={<Link href={`/saisie/soin?horse=${horse.id}`}>Ajouter</Link>}>
            <ul style={ulReset}>
              <AnimatePresence initial={false}>
                {horseAgenda.map((a) => (
                  <AgendaRow key={a.event.id} p={a} horseName={horse.name} showHorse={false} />
                ))}
                {horseDeadlines.map((d) => (
                  <DeadlineRow key={d.kind} d={d} horseName={horse.name} showHorse={false} />
                ))}
              </AnimatePresence>
            </ul>
          </Sec>
        )}

        <Sec ill="carnet-buste" title="Son carnet" action={careLog.length > 0 ? <Link href="/planning">Tout le carnet</Link> : undefined}>
          {careLog.length === 0 ? (
            <Link href={`/saisie/soin?horse=${horse.id}`} className="li">
              <span className="ch-ico">
                <Ic n="plus" className="" />
              </span>
              <span>
                <small>Note son premier soin (vaccin, ferrure…) : les rappels se calculeront tout seuls.</small>
              </span>
              <Ic n="chev" className="chev" />
            </Link>
          ) : (
            <div className="rows">
              {careLog.map((e) => (
                <div key={e.id} className="li">
                  <span className="ch-ico">
                    <Ic n={e.kind === "ferrure" ? "shoe" : "syringe"} className="" />
                  </span>
                  <span>
                    <b>{CARE_META[e.kind].label}</b>
                    <small>
                      {e.date.slice(8, 10)}/{e.date.slice(5, 7)}/{e.date.slice(2, 4)}
                      {e.label ? ` · ${e.label}` : ""}
                      {e.provider ? ` · ${e.provider}` : ""}
                    </small>
                  </span>
                  {e.cost ? <Money v={-e.cost} /> : <span />}
                </div>
              ))}
            </div>
          )}
        </Sec>

        {(recRevenues.length > 0 || recExpenses.length > 0) && (
          <Sec nomarge title="Récurrents">
            <div className="rows">
              {recRevenues.map((r) => (
                <div key={r.id} className="li" style={{ gridTemplateColumns: "1fr auto auto" }}>
                  <span>
                    <b>{r.label ?? "Pension"}</b>
                    <small>{freqLabel(r.frequency)} · revenu</small>
                  </span>
                  <span className="in">+{formatEur(r.amount)}</span>
                  <button type="button" style={trashBtn} onClick={() => confirm("Arrêter ce revenu récurrent ?") && delRecRevenue(r.id)} aria-label="Arrêter">
                    <Ic n="trash" className="cn-ic sm" />
                  </button>
                </div>
              ))}
              {recExpenses.map((r) => (
                <div key={r.id} className="li" style={{ gridTemplateColumns: "1fr auto auto" }}>
                  <span>
                    <b>{r.label}</b>
                    <small>{freqLabel(r.frequency)} · charge</small>
                  </span>
                  <span className="out">−{formatEur(r.amount)}</span>
                  <button type="button" style={trashBtn} onClick={() => confirm("Arrêter cette charge récurrente ?") && delRecExpense(r.id)} aria-label="Arrêter">
                    <Ic n="trash" className="cn-ic sm" />
                  </button>
                </div>
              ))}
            </div>
          </Sec>
        )}

        {movements.length > 0 && (
          <Sec nomarge title="Ses mouvements ce mois">
            <div className="rows">
              {movements.map((m) => (
                <div key={m.id} className="li" style={{ gridTemplateColumns: "44px 1fr auto auto" }}>
                  <small className="mono">
                    {m.date.slice(8, 10)}/{m.date.slice(5, 7)}
                  </small>
                  <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.label}</b>
                  <Money v={m.isIn ? m.amount : -m.amount} />
                  <button type="button" style={trashBtn} onClick={() => confirm(`Supprimer « ${m.label} » (${formatEur(m.amount)}) ?`) && (m.isIn ? delRevenue(m.id) : delDirect(m.id))} aria-label="Supprimer">
                    <Ic n="trash" className="cn-ic sm" />
                  </button>
                </div>
              ))}
            </div>
          </Sec>
        )}

        {sharedContrib.length > 0 && (
          <Sec nomarge title={<Explain k="charges_mutualisees">Sa part des charges partagées</Explain>}>
            <div className="rows">
              {sharedContrib.map((c) => (
                <div key={c.label} className="li" style={{ gridTemplateColumns: "1fr auto" }}>
                  <span>{c.label}</span>
                  <Money v={-c.amount} />
                </div>
              ))}
            </div>
          </Sec>
        )}

        <div className="ch-after" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Link href={`/saisie?kind=revenu&horse=${horse.id}`} className="btn line">
            Ajouter un revenu
          </Link>
          <Link href={`/saisie?kind=charge&horse=${horse.id}`} className="btn">
            Ajouter une charge
          </Link>
        </div>

        {!horse.isArchived && (
          <div className="ch-leave">
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                if (confirm(`${horse.name} quitte l’écurie ? Il sera archivé : ses chiffres restent dans ton historique.`)) {
                  archiveHorse(horse.id);
                  router.push("/ecurie");
                }
              }}
            >
              Archiver {horse.name} (il quitte l’écurie)
            </button>
          </div>
        )}

        <p className="note" style={{ textAlign: "center" }}>
          Glisse pour passer à {next.horse.name}
        </p>
        <div className="end" />
      </Ecran>
    </motion.div>
  );
}
