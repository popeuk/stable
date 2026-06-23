import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Coin, Pill } from "../_ui";
import { buildDemoData } from "@/lib/data/demo-data";
import { horsePnl } from "@/lib/domain/calculations";
import { currentPeriod } from "@/lib/utils/period";

function eur(n: number) {
  const v = new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n)));
  return `${n < 0 ? "−" : ""}${v} €`;
}

/* Fiche cheval — la rentabilité d'un cheval, expliquée simplement. */
export default function ProtoCheval() {
  const data = buildDemoData();
  const period = currentPeriod();

  // On montre le cheval le plus parlant : le moins rentable.
  const ranked = data.horses
    .filter((h) => !h.isArchived)
    .map((h) => ({ horse: h, p: horsePnl(data, h.id, period) }))
    .sort((a, b) => a.p.netResult - b.p.netResult);
  const { horse, p } = ranked[0];

  const ok = p.netResult >= 0;
  const coverRatio = p.threshold > 0 ? Math.min(1, p.revenue / p.threshold) : 1;

  return (
    <main
      className="mx-auto min-h-dvh max-w-[440px] px-5 pb-10 pt-5"
      style={{ background: "var(--p-page)" }}
    >
      <div className="flex items-center justify-between">
        <Link
          href="/proto/aujourdhui"
          className="flex size-9 items-center justify-center rounded-full border-[2.5px] border-[var(--p-ink)] bg-white"
        >
          <ChevronLeft size={18} />
        </Link>
        <Pill bg={ok ? "var(--p-mint)" : "var(--p-pink)"}>
          {ok ? "Il rapporte" : "Il coûte"}
        </Pill>
      </div>

      <h1 className="proto-disp mt-5 text-[42px]">{horse.name}</h1>
      <p className="text-[14px] font-bold text-[var(--p-muted)]">
        {`${horse.breed ?? ""}${horse.birthYear ? ` · ${new Date().getFullYear() - horse.birthYear} ans` : ""}`}
      </p>

      {/* Hero */}
      <p className="mt-6 text-[14px] font-bold uppercase tracking-wide text-[var(--p-muted)]">
        {"Ce qu’il te laisse ce mois"}
      </p>
      <p className="proto-disp text-[56px]" style={{ color: ok ? "#2f8f5b" : "#c0392b" }}>
        {eur(p.netResult)}
      </p>

      {/* Deux cartes : entre / sort */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div
          className="rounded-[20px] border-[2.5px] border-[var(--p-ink)] p-4"
          style={{ background: "var(--p-mint)", boxShadow: "0 3px 0 var(--p-ink)" }}
        >
          <p className="text-[12px] font-bold uppercase text-[var(--p-ink)]/60">{"Il fait rentrer"}</p>
          <p className="proto-disp mt-1 text-[26px]">{eur(p.revenue)}</p>
        </div>
        <div
          className="rounded-[20px] border-[2.5px] border-[var(--p-ink)] p-4"
          style={{ background: "var(--p-peach)", boxShadow: "0 3px 0 var(--p-ink)" }}
        >
          <p className="text-[12px] font-bold uppercase text-[var(--p-ink)]/60">{"Il te coûte"}</p>
          <p className="proto-disp mt-1 text-[26px]">{eur(p.threshold)}</p>
        </div>
      </div>

      {/* Seuil, expliqué */}
      <div
        className="mt-4 rounded-[22px] border-[2.5px] border-[var(--p-ink)] bg-white p-5"
        style={{ boxShadow: "0 3px 0 var(--p-ink)" }}
      >
        <p className="text-[15px] font-extrabold">{"Son seuil de rentabilité"}</p>
        <p className="mt-1 text-[13px] font-semibold text-[var(--p-muted)]">
          {`Pour être à l’équilibre, il doit te rapporter au moins ${eur(p.threshold)}. Là, il en rapporte ${eur(p.revenue)}.`}
        </p>
        <div className="mt-3 h-3.5 overflow-hidden rounded-full border-[2.5px] border-[var(--p-ink)] bg-[var(--p-page)]">
          <div
            className="h-full"
            style={{ width: `${coverRatio * 100}%`, background: ok ? "#2f8f5b" : "#c0392b" }}
          />
        </div>
      </div>

      {/* Le copilote */}
      <div
        className="mt-4 rounded-[22px] border-[2.5px] border-[var(--p-ink)] p-4"
        style={{ background: "var(--p-purple)", boxShadow: "0 4px 0 var(--p-ink)" }}
      >
        <div className="flex items-start gap-3">
          <Coin size={36} />
          <p className="text-[15px] font-semibold text-white">
            {ok
              ? `${horse.name} dégage ${eur(p.netResult)} ce mois. Solide — garde le cap.`
              : `${horse.name} te coûte ${eur(Math.abs(p.netResult))} de plus qu’il ne rapporte. Une légère hausse de pension le remettrait à flot.`}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link
          href="/proto/lecon"
          className="flex items-center justify-center rounded-full border-[2.5px] border-[var(--p-ink)] bg-white py-3 text-[14px] font-extrabold"
        >
          {"Comprendre la marge"}
        </Link>
        <Link
          href="/proto/aujourdhui"
          className="flex items-center justify-center rounded-full border-[2.5px] border-[var(--p-ink)] bg-[var(--p-lime)] py-3 text-[14px] font-extrabold"
        >
          {"Tester une hausse"}
        </Link>
      </div>
    </main>
  );
}
