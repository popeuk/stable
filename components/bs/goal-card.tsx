"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { seanceAmount } from "@/lib/domain/seances";
import { currentPeriod, dateInPeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";
import { eur, signed } from "@/components/bs/ui";

/** Ce qui est encore prévu ce mois-ci : séances à venir, moins les soins prévus. */
export function plannedRest(data: ReturnType<typeof useDataStore.getState>, today: string): number {
  const p = currentPeriod();
  const s = (data.seances ?? []).filter((x) => x.status === "planned" && x.date >= today && dateInPeriod(x.date, p)).reduce((t, x) => t + seanceAmount(x), 0);
  const c = (data.careEvents ?? []).filter((e) => e.pending && e.date >= today && dateInPeriod(e.date, p)).reduce((t, e) => t + (e.revenue ?? 0) - (e.cost ?? 0), 0);
  return s + c;
}

/** L'objectif du mois : ce qui est validé, ce qui est encore prévu, ce qui manque. */
export function GoalCard({ href = "/argent" }: { href?: string }) {
  const data = useDataStore();
  const objective = useSettingsStore((s) => s.objective);
  const today = localToday();
  const m = useMemo(() => monthBreakdown(data, currentPeriod()), [data]);
  const rest = useMemo(() => plannedRest(data, today), [data, today]);
  const pct = objective > 0 ? Math.max(0, Math.min(100, (m.net / objective) * 100)) : 0;
  const restPct = objective > 0 ? Math.max(0, Math.min(100 - pct, (rest / objective) * 100)) : 0;
  const left = Math.max(0, objective - m.net);
  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const month = now.toLocaleDateString("fr-FR", { month: "long" });
  return (
    <Link href={href} className="bs-goal">
      <span className="k">Ton objectif pour {month} : te verser {eur(objective)}</span>
      <span className="row">
        <span className={`bs-big${m.net < 0 ? " neg" : ""}`}>{signed(m.net)}</span>
        <span style={{ fontSize: 12, color: "var(--on-vert)" }}>ce qui te reste au {now.getDate()} {month}</span>
      </span>
      <span className="trk" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
        <b style={{ left: `${pct}%`, width: `${restPct}%` }} />
      </span>
      <span className="lab">
        <span>{Math.round(pct)} %</span>
        <span>
          {rest > 0 ? `${signed(rest)} encore prévus · ` : ""}
          {left > 0 ? `il manque ${eur(left)}` : "objectif atteint"} · {daysLeft} j restants
        </span>
      </span>
    </Link>
  );
}
