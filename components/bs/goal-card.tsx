"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { seanceAmount } from "@/lib/domain/seances";
import { currentPeriod, dateInPeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";
import { CountUp, Ill, Money, Steam, eur } from "@/components/carnet/ui";

/** Ce qui est encore prévu ce mois-ci : séances à venir, moins les soins prévus. */
export function plannedRest(data: ReturnType<typeof useDataStore.getState>, today: string): number {
  const p = currentPeriod();
  const s = (data.seances ?? []).filter((x) => x.status === "planned" && x.date >= today && dateInPeriod(x.date, p)).reduce((t, x) => t + seanceAmount(x), 0);
  const c = (data.careEvents ?? []).filter((e) => e.pending && e.date >= today && dateInPeriod(e.date, p)).reduce((t, e) => t + (e.revenue ?? 0) - (e.cost ?? 0), 0);
  return s + c;
}

/** « d’octobre », « de novembre ». */
const deMois = (m: string) => (/^[aeiouyàâéè]/i.test(m) ? `d’${m}` : `de ${m}`);

/**
 * L'objectif du mois : ce qui compte déjà, ce qui est encore prévu, ce qui
 * manque. perch : la gérante assise sur la carte, son café qui fume
 * (accueil). desk : la version de l'accueil sur ordinateur.
 */
export function GoalCard({ href = "/argent", perch, desk }: { href?: string; perch?: boolean; desk?: boolean }) {
  const data = useDataStore();
  const objective = useSettingsStore((s) => s.objective);
  const gerant = useSettingsStore((s) => s.gerant);
  const today = localToday();
  const m = useMemo(() => monthBreakdown(data, currentPeriod()), [data]);
  const rest = useMemo(() => plannedRest(data, today), [data, today]);
  const pct = objective > 0 ? Math.max(0, Math.min(100, (m.net / objective) * 100)) : 0;
  const restPct = objective > 0 ? Math.max(0, Math.min(100 - pct, (rest / objective) * 100)) : 0;
  const left = Math.max(0, objective - m.net);
  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const month = now.toLocaleDateString("fr-FR", { month: "long" });
  const tone = Math.round(m.net) > 0 ? "in" : Math.round(m.net) < 0 ? "out" : "";
  const jours = daysLeft > 1 ? `il reste ${daysLeft} jours` : daysLeft === 1 ? "il reste 1 jour" : "c’est le dernier jour du mois";

  const card = desk ? (
    <Link href={href} className="moncard card mt-goal">
      <p className="k">Ce mois, il te reste</p>
      <p className={`big ${tone}`}>
        <CountUp value={m.net} />
      </p>
      <p className="note">{m.net >= 0 ? "Le foin, le maréchal et le loyer sont payés. Le reste est pour toi." : "Ce mois, tes frais dépassent encore ce qui est rentré."}</p>
      {objective > 0 && (
        <>
          <div className="bar" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="bar-lab">
            <span>Tu as fait {Math.round(pct)} % du chemin</span>
            <span>objectif : {eur(objective)}</span>
          </div>
        </>
      )}
    </Link>
  ) : (
    <Link href={href} className="moncard mt-goal">
      <p className="k">{objective > 0 ? `Ton objectif ${deMois(month)} : te verser ${eur(objective)}` : "Ce mois, il te reste"}</p>
      <p className={`big ${tone}`}>
        <CountUp value={m.net} />
      </p>
      <p className="sub">
        ce qui te reste au {now.getDate()} {month}, tout payé
      </p>
      {objective > 0 && (
        <>
          <div className="bar" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
            {restPct > 0 && <i className="plan" style={{ left: `${pct}%`, width: `${restPct}%` }} />}
          </div>
          <div className="bar-lab">
            <span>
              <i className="sw" />
              {Math.round(pct)} % qui compte
            </span>
            <span>
              <i className="sw plan" />
              prévu
            </span>
          </div>
        </>
      )}
      <p className="note">
        {objective > 0 && left > 0 ? (
          <>
            Il te manque <b>{eur(left)}</b> pour l’atteindre, et {jours}.
          </>
        ) : objective > 0 ? (
          <>Objectif atteint, et {jours}.</>
        ) : (
          <>Fixe-toi un objectif dans le Bilan.</>
        )}
        {Math.round(rest) !== 0 && (
          <>
            {" "}
            Encore <Money v={rest} /> {rest > 0 ? "sont prévus" : "de frais sont prévus"} au planning.
          </>
        )}
      </p>
    </Link>
  );

  if (!perch) return card;
  return (
    <div className="perch rise" style={{ animationDelay: "0.12s" }}>
      <div className="sitw">
        <Ill n="assise" alt={`${gerant || "La gérante"}, assise sur son chiffre du mois, une tasse de café à la main.`} />
        <Steam />
      </div>
      {card}
    </div>
  );
}
