import Link from "next/link";
import { ChevronLeft, Info } from "lucide-react";
import { Coin, Pill } from "../_ui";
import { buildDemoData } from "@/lib/data/demo-data";
import { stablePnl, horsePnl } from "@/lib/domain/calculations";
import { currentPeriod } from "@/lib/utils/period";
import { formatMonthName } from "@/lib/utils/format-date";

function eur(n: number) {
  const v = new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n)));
  return `${n < 0 ? "−" : ""}${v} €`;
}

/* Tableau de bord du copilote — structure inspirée de Macadam,
   mais branchée sur la vraie rentabilité (données de démo). */
export default function ProtoToday() {
  const data = buildDemoData();
  const period = currentPeriod();
  const pnl = stablePnl(data, period);

  const horses = data.horses
    .filter((h) => !h.isArchived)
    .map((h) => ({ horse: h, p: horsePnl(data, h.id, period) }))
    .sort((a, b) => b.p.netResult - a.p.netResult);

  const charges = pnl.directCosts + pnl.sharedCosts;
  const kept = pnl.netResult;
  const positive = kept >= 0;
  const coverRatio = pnl.revenue > 0 ? Math.min(1, charges / pnl.revenue) : 1;

  const best = horses[0];
  const worst = horses[horses.length - 1];

  return (
    <main
      className="mx-auto min-h-dvh max-w-[440px] px-5 pb-10 pt-5"
      style={{ background: "var(--p-page)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/proto/onboarding"
            className="flex size-9 items-center justify-center rounded-full border-[2.5px] border-[var(--p-ink)] bg-white"
          >
            <ChevronLeft size={18} />
          </Link>
          <span className="proto-disp text-[22px] capitalize">
            {formatMonthName(period)}
          </span>
        </div>
        <Pill bg="var(--p-lime)">{"Mois en cours"}</Pill>
      </div>

      {/* Hero : ce que tu gardes */}
      <p className="mt-6 text-[14px] font-bold uppercase tracking-wide text-[var(--p-muted)]">
        {"Ce mois, tu gardes"}
      </p>
      <p
        className="proto-disp text-[58px]"
        style={{ color: positive ? "#2f8f5b" : "#c0392b" }}
      >
        {eur(kept)}
      </p>

      {/* Barre revenus / charges */}
      <div className="mt-2 flex justify-between text-[13px] font-bold">
        <span className="text-[var(--p-muted)]">{`Charges ${eur(charges)}`}</span>
        <span>{`Revenus ${eur(pnl.revenue)}`}</span>
      </div>
      <div className="mt-1 h-3.5 overflow-hidden rounded-full border-[2.5px] border-[var(--p-ink)] bg-white">
        <div
          className="h-full"
          style={{ width: `${coverRatio * 100}%`, background: "var(--p-purple)" }}
        />
      </div>
      <p className="mt-1.5 text-[13px] font-semibold text-[var(--p-muted)]">
        {positive
          ? `Tes revenus couvrent tes charges. Le reste, ${eur(kept)}, c’est pour toi.`
          : `Tes charges dépassent tes revenus de ${eur(Math.abs(kept))}.`}
      </p>

      {/* Tes chevaux (façon "All Levels") */}
      <div className="mt-7 flex items-center justify-between">
        <span className="proto-disp text-[17px] flex items-center gap-1.5">
          {"Tes chevaux"} <Info size={15} className="opacity-40" />
        </span>
        <Link href="/proto/aujourdhui" className="text-[13px] font-bold text-[var(--p-purple)]">
          {"Tout voir ›"}
        </Link>
      </div>
      <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
        {horses.slice(0, 5).map((h, i) => {
          const ok = h.p.netResult >= 0;
          return (
            <div
              key={h.horse.id}
              className="flex w-[88px] shrink-0 flex-col items-center rounded-[18px] border-[2.5px] border-[var(--p-ink)] px-2 py-3"
              style={{
                background: i === 0 ? "var(--p-mint)" : "white",
                boxShadow: "0 3px 0 var(--p-ink)",
              }}
            >
              <span className="proto-disp text-[14px] truncate w-full text-center">
                {h.horse.name}
              </span>
              <span className="mt-1 text-[12px] font-extrabold" style={{ color: ok ? "#2f8f5b" : "#c0392b" }}>
                {eur(h.p.netResult)}
              </span>
              <span className="mt-1 text-[10px] font-bold uppercase text-[var(--p-muted)]">
                {ok ? "rapporte" : "coûte"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Le copilote te parle */}
      <div
        className="mt-7 rounded-[22px] border-[2.5px] border-[var(--p-ink)] p-4"
        style={{ background: "var(--p-purple)", boxShadow: "0 4px 0 var(--p-ink)" }}
      >
        <div className="flex items-start gap-3">
          <Coin size={36} />
          <p className="text-[15px] font-semibold text-white">
            {`Cette semaine, garde un œil sur ${worst.horse.name}. Et ${best.horse.name} est ta belle surprise du mois.`}
          </p>
        </div>
      </div>

      {/* Tes missions (façon "Daily Challenges") */}
      <p className="mt-7 proto-disp text-[17px]">{"Tes missions de la semaine"}</p>
      <div className="mt-3 space-y-2.5">
        <Mission
          title="Comprends ta marge nette"
          sub="Une mini-leçon sur tes vrais chiffres"
          pill="2 min"
          pillBg="var(--p-mint)"
        />
        <Mission
          title={`Regarde ${worst.horse.name} de près`}
          sub={worst.p.netResult >= 0 ? "Ton cheval le plus juste" : "Il te coûte de l’argent"}
          pill={eur(worst.p.netResult)}
          pillBg="var(--p-pink)"
        />
        <Mission
          title="Saisis le foin du mois"
          sub="Réparti tout seul sur tes chevaux"
          pill="à faire"
          pillBg="var(--p-lime)"
        />
      </div>

      {/* CTA */}
      <Link
        href="/proto"
        className="mt-7 flex items-center justify-between rounded-full border-[2.5px] border-[var(--p-ink)] bg-[var(--p-ink)] px-3 py-3 pl-4 text-white"
        style={{ boxShadow: "0 4px 0 rgba(0,0,0,0.35)" }}
      >
        <span className="flex items-center gap-3">
          <Coin size={38} />
          <span className="proto-disp text-[18px]">{"Faire le point de la semaine"}</span>
        </span>
        <span className="proto-disp mr-2 text-[18px]">{"››"}</span>
      </Link>
    </main>
  );
}

function Mission({
  title,
  sub,
  pill,
  pillBg,
}: {
  title: string;
  sub: string;
  pill: string;
  pillBg: string;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-[18px] border-[2.5px] border-[var(--p-ink)] bg-white p-4"
      style={{ boxShadow: "0 3px 0 var(--p-ink)" }}
    >
      <div className="pr-3">
        <p className="text-[15px] font-extrabold leading-tight">{title}</p>
        <p className="mt-0.5 text-[13px] font-semibold text-[var(--p-muted)]">{sub}</p>
      </div>
      <Pill bg={pillBg}>{pill}</Pill>
    </div>
  );
}
