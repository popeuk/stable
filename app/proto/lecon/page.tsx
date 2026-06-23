import Link from "next/link";
import { X } from "lucide-react";
import { Coin, Pill } from "../_ui";
import { buildDemoData } from "@/lib/data/demo-data";
import { stablePnl } from "@/lib/domain/calculations";
import { currentPeriod } from "@/lib/utils/period";

function eur(n: number) {
  const v = new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n)));
  return `${n < 0 ? "−" : ""}${v} €`;
}

/* Mini-leçon — un concept expliqué simplement, sur les vrais chiffres. */
export default function ProtoLecon() {
  const data = buildDemoData();
  const period = currentPeriod();
  const p = stablePnl(data, period);
  const pct = p.revenue > 0 ? Math.round((p.netResult / p.revenue) * 100) : 0;

  return (
    <main
      className="mx-auto min-h-dvh max-w-[440px] px-5 pb-10 pt-5"
      style={{ background: "var(--p-lime)" }}
    >
      <div className="flex items-center justify-between">
        <Pill bg="white">{"Mini-leçon · 2 min"}</Pill>
        <Link
          href="/proto/aujourdhui"
          className="flex size-9 items-center justify-center rounded-full border-[2.5px] border-[var(--p-ink)] bg-white"
        >
          <X size={18} />
        </Link>
      </div>

      <h1 className="proto-disp mt-8 text-[44px]">{"La marge nette"}</h1>
      <p className="mt-3 text-[18px] font-semibold">
        {"C’est ce qu’il te reste vraiment, une fois toutes tes charges payées."}
      </p>

      {/* Pour toi, ça veut dire */}
      <div
        className="mt-7 rounded-[24px] border-[2.5px] border-[var(--p-ink)] bg-white p-5"
        style={{ boxShadow: "0 4px 0 var(--p-ink)" }}
      >
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-[var(--p-purple)]">
          {"Pour toi, ce mois"}
        </p>
        <p className="mt-2 text-[16px] font-semibold leading-relaxed">
          {`Tu as fait `}
          <b>{eur(p.revenue)}</b>
          {` de revenus et payé `}
          <b>{eur(p.directCosts + p.sharedCosts)}</b>
          {` de charges. Il te reste `}
          <b style={{ color: "#2f8f5b" }}>{eur(p.netResult)}</b>
          {` — c’est ta marge nette, soit `}
          <b>{`${pct} %`}</b>
          {` de tes revenus.`}
        </p>
      </div>

      {/* Ce que tu peux faire */}
      <p className="mt-7 proto-disp text-[18px]">{"Ce que tu peux faire"}</p>
      <ul className="mt-3 space-y-2.5">
        {[
          "Si elle baisse mois après mois, tes charges montent plus vite que tes revenus.",
          "Deux leviers pour la remonter : augmenter tes prix, ou baisser tes coûts.",
        ].map((t, i) => (
          <li
            key={i}
            className="flex gap-3 rounded-[18px] border-[2.5px] border-[var(--p-ink)] bg-[var(--p-peach)] p-4 text-[15px] font-semibold"
            style={{ boxShadow: "0 3px 0 var(--p-ink)" }}
          >
            <span className="proto-disp text-[18px]">{i + 1}</span>
            {t}
          </li>
        ))}
      </ul>

      <Link
        href="/proto/aujourdhui"
        className="mt-8 flex items-center justify-center gap-3 rounded-full border-[2.5px] border-[var(--p-ink)] bg-[var(--p-ink)] py-3.5 text-white"
        style={{ boxShadow: "0 4px 0 rgba(0,0,0,0.35)" }}
      >
        <Coin size={34} />
        <span className="proto-disp text-[18px]">{"J’ai compris"}</span>
      </Link>
    </main>
  );
}
