"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ClientGate } from "@/components/ui/client-gate";
import { Explain } from "@/components/ed/explain";
import { Chips, Empty, Hello, Ic, Money, Page, Sec, eur } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { RANGE_PRESETS, periodStart, rangePeriods, type RangePreset } from "@/lib/utils/period";
import { aggregateStablePnl } from "@/lib/domain/calculations";
import { partageLabel, repartition } from "@/lib/domain/presence";

/**
 * The Journal: every euro in and out, in one list. The owner's paper notebook,
 * digitised — including the ability to fix a wrong entry (delete both sides).
 */
interface Row {
  id: string;
  date: string;
  label: string;
  target: string;
  amount: number;
  kind: "revenue" | "direct" | "shared";
}

type Filter = "tout" | "entrees" | "sorties";

function shortDate(iso: string) {
  return format(new Date(iso + "T00:00:00"), "d MMM", { locale: fr });
}

function freqLabel(f: string) {
  return f === "monthly" ? "chaque mois" : f === "quarterly" ? "tous les 3 mois" : "chaque année";
}

function icFor(label: string, kind: Row["kind"]): string {
  const l = label.toLowerCase();
  if (/pension|retraite/.test(l)) return "horse";
  if (/foin/.test(l)) return "hay";
  if (/loyer/.test(l)) return "home";
  if (/granul|aliment/.test(l)) return "board";
  if (/liti|paille|copeau/.test(l)) return "list";
  if (/assurance/.test(l)) return "doc";
  if (/maréchal|marechal|ferr/.test(l)) return "shoe";
  if (/soin|véto|veto|vacc|vermif|compl|dentiste/.test(l)) return "syringe";
  if (/salaire|cours|séance|seance|balade|stage/.test(l)) return "user";
  return kind === "shared" ? "hay" : "euro";
}

export default function JournalPage() {
  return (
    <ClientGate>
      <Journal />
    </ClientGate>
  );
}

function Journal() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const preset = usePeriodStore((s) => s.preset);
  const setPreset = usePeriodStore((s) => s.setPreset);
  const periods = useMemo(() => rangePeriods(active, preset), [active, preset]);
  const deleteRevenue = useDataStore((s) => s.deleteRevenue);
  const deleteDirect = useDataStore((s) => s.deleteDirectExpense);
  const deleteShared = useDataStore((s) => s.deleteSharedExpense);
  const deleteRecurring = useDataStore((s) => s.stopRecurringExpense);
  const deleteRecurringRevenue = useDataStore((s) => s.stopRecurringRevenue);
  const [filter, setFilter] = useState<Filter>("tout");

  const recurrings = useMemo(() => data.recurringExpenses ?? [], [data.recurringExpenses]);
  const recurringRevs = useMemo(() => data.recurringRevenues ?? [], [data.recurringRevenues]);

  const horseName = (id: string) => data.horses.find((h) => h.id === id)?.name ?? "cheval retiré";
  const catName = (id?: string) => data.revenueCategories.find((c) => c.id === id)?.name;

  const rows = useMemo<Row[]>(() => {
    const inRange = (y: number, m: number) => periods.some((p) => p.year === y && p.month === m);
    const out: Row[] = [];
    for (const r of data.revenues) {
      const y = Number(r.date.slice(0, 4));
      const m = Number(r.date.slice(5, 7));
      if (!inRange(y, m)) continue;
      out.push({
        id: r.id,
        date: r.date,
        label: catName(r.categoryId) ?? "Rentrée d’argent",
        target: horseName(r.horseId),
        amount: r.amount,
        kind: "revenue",
      });
    }
    for (const e of data.directExpenses) {
      const y = Number(e.date.slice(0, 4));
      const m = Number(e.date.slice(5, 7));
      if (!inRange(y, m)) continue;
      out.push({ id: e.id, date: e.date, label: e.label, target: horseName(e.horseId), amount: e.amount, kind: "direct" });
    }
    for (const s of data.sharedExpenses) {
      if (!inRange(s.periodYear, s.periodMonth)) continue;
      out.push({
        id: s.id,
        date: periodStart({ year: s.periodYear, month: s.periodMonth }),
        label: s.label,
        target: partageLabel(repartition(data, s).length),
        amount: s.totalAmount,
        kind: "shared",
      });
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.revenues, data.directExpenses, data.sharedExpenses, periods]);

  const visible = rows.filter((r) => (filter === "tout" ? true : filter === "entrees" ? r.kind === "revenue" : r.kind !== "revenue"));

  // The same aggregation as the home equation — the two screens always agree.
  const agg = useMemo(() => aggregateStablePnl(data, periods), [data, periods]);

  function remove(r: Row) {
    if (!confirm(`Supprimer « ${r.label} » (${eur(r.amount)}) ? Cette ligne disparaîtra de tes comptes.`)) return;
    if (r.kind === "revenue") deleteRevenue(r.id);
    else if (r.kind === "direct") deleteDirect(r.id);
    else deleteShared(r.id);
  }

  const presets = RANGE_PRESETS.filter((r) => ["month", "3m", "ytd"].includes(r.value)).map((r) => [r.value, r.label] as [RangePreset, string]);

  return (
    <Page>
      <h1 className="ar-sr">Entrées et sorties d’argent</h1>
      <Hello title="Entrées et sorties d’argent" sub="Tout ce qui est rentré et sorti, ligne par ligne. Tu peux supprimer une ligne notée par erreur." />

      <div className="ar-filt">
        <Chips value={preset} onChange={setPreset} options={presets} />
      </div>

      {/* Totaux identiques à l'équation de l'accueil */}
      <div className="trio ar-sum3 rise" style={{ animationDelay: ".08s" }}>
        <div>
          <b className="in">{agg.revenue ? `+${eur(agg.revenue)}` : eur(0)}</b>
          <small>
            <Explain k="chiffre_affaires">Ce qui rentre</Explain>
          </small>
        </div>
        <div>
          <b className="out">{agg.charges ? `−${eur(agg.charges)}` : eur(0)}</b>
          <small>
            <Explain k="depenses">Ce qui sort</Explain>
          </small>
        </div>
        <div>
          <b>
            <Money v={agg.netResult} />
          </b>
          <small>
            <Explain k="marge_nette">Ce qui te reste</Explain>
          </small>
        </div>
      </div>

      {/* Filtre */}
      <div className="ar-filt">
        <Chips
          value={filter}
          onChange={setFilter}
          options={[
            ["tout", "Tout"],
            ["entrees", "Ce qui rentre"],
            ["sorties", "Ce qui sort"],
          ]}
        />
      </div>

      {/* Récurrents actifs (pensions et charges) */}
      {(recurrings.length > 0 || recurringRevs.length > 0) && filter === "tout" && (
        <Sec blk ill="carnet-buste" delay={0.12} title="Compté tout seul, chaque mois" action={<Link href="/saisie">+ Ajouter</Link>}>
          {recurringRevs.map((r) => (
            <div key={r.id} className="ar-rec">
              <span className="ar-pic">
                <Ic n="clock" className="ar-ic" />
              </span>
              <span style={{ minWidth: 0 }}>
                <b>
                  {r.label ?? "Pension"} · {horseName(r.horseId)}
                </b>
                <small>
                  rentre {freqLabel(r.frequency)}
                  {r.endDate ? ` · jusqu’au ${shortDate(r.endDate)}` : " · sans date de fin"}
                </small>
              </span>
              <span className="ar-rt">
                <Money v={r.amount} />
                <button type="button" className="lnk" onClick={() => confirm(`Arrêter cette rentrée d’argent qui revient chaque mois ?`) && deleteRecurringRevenue(r.id)} aria-label={`Arrêter ${r.label ?? "la pension"}`}>
                  Arrêter
                </button>
              </span>
            </div>
          ))}
          {recurrings.map((r) => (
            <div key={r.id} className="ar-rec">
              <span className="ar-pic">
                <Ic n="clock" className="ar-ic" />
              </span>
              <span style={{ minWidth: 0 }}>
                <b>{r.label}</b>
                <small>
                  {freqLabel(r.frequency)} · {r.isShared ? "frais communs" : "pour 1 cheval"}
                  {r.endDate ? ` · jusqu’au ${shortDate(r.endDate)}` : " · sans date de fin"}
                </small>
              </span>
              <span className="ar-rt">
                <Money v={-r.amount} />
                <button type="button" className="lnk" onClick={() => confirm(`Arrêter « ${r.label} » ? Elle ne sera plus comptée chaque mois.`) && deleteRecurring(r.id)} aria-label={`Arrêter ${r.label}`}>
                  Arrêter
                </button>
              </span>
            </div>
          ))}
        </Sec>
      )}

      {/* Mouvements ponctuels */}
      {visible.length === 0 ? (
        <Empty>
          {rows.length > 0
            ? "Rien de ce côté sur cette période."
            : recurrings.length + recurringRevs.length > 0
              ? "Rien d’autre sur cette période. Seul ce qui revient chaque mois est compté."
              : "Rien de noté sur cette période. Ajoute une dépense ou une rentrée d’argent pour la voir ici."}
        </Empty>
      ) : (
        <div className="rise" style={{ animationDelay: ".16s", marginTop: 10 }}>
          {visible.map((r) => {
            const isIn = r.kind === "revenue";
            return (
              <div key={r.id} className="ar-mv">
                <span className="ar-pic">
                  <Ic n={icFor(r.label, r.kind)} className="ar-ic" />
                </span>
                <span style={{ minWidth: 0 }}>
                  <b>{r.label}</b>
                  <small>
                    {shortDate(r.date)} · {r.target}
                  </small>
                </span>
                <Money v={isIn ? r.amount : -r.amount} />
                <button type="button" className="ar-bin" onClick={() => remove(r)} aria-label={`Supprimer ${r.label}`}>
                  <Ic n="trash" className="ar-ic" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="end" />
    </Page>
  );
}
