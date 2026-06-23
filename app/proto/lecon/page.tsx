import Link from "next/link";
import { TopBar, Tag } from "../_ui";
import { BottomNav } from "../_nav";
import { buildDemoData } from "@/lib/data/demo-data";
import { stablePnl } from "@/lib/domain/calculations";
import { currentPeriod } from "@/lib/utils/period";

function eur(n: number) {
  const v = new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n)));
  return `${n < 0 ? "−" : ""}${v} €`;
}

export default function ProtoLecon() {
  const data = buildDemoData();
  const period = currentPeriod();
  const p = stablePnl(data, period);
  const pct = p.revenue > 0 ? Math.round((p.netResult / p.revenue) * 100) : 0;

  const levers = [
    "Si elle baisse mois après mois, tes charges montent plus vite que tes revenus.",
    "Deux leviers pour la remonter : augmenter tes prix, ou baisser tes coûts.",
  ];

  return (
    <main className="mx-auto min-h-dvh max-w-[440px] pb-24">
      <TopBar />

      <div className="px-5 pt-5">
        <Tag>{"Mini-leçon · 2 min"}</Tag>
        <h1 className="mt-4 text-[40px] font-extrabold leading-[0.98]">{"La marge nette"}</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-[var(--o-muted)]">
          {"C’est ce qu’il te reste vraiment, une fois toutes tes charges payées."}
        </p>
      </div>

      {/* Pour toi */}
      <div className="mx-5 mt-6 border border-[var(--o-line-strong)] bg-[var(--o-paper)] p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--o-accent)]">
          {"Pour toi, ce mois"}
        </p>
        <p className="mt-2 text-[16px] leading-relaxed">
          {"Tu as fait "}
          <b>{eur(p.revenue)}</b>
          {" de revenus et payé "}
          <b>{eur(p.directCosts + p.sharedCosts)}</b>
          {" de charges. Il te reste "}
          <b style={{ color: "var(--o-green)" }}>{eur(p.netResult)}</b>
          {" — ta marge nette, soit "}
          <b>{`${pct} %`}</b>
          {" de tes revenus."}
        </p>
      </div>

      {/* Leviers */}
      <div className="px-5 pt-7">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--o-muted)]">
          {"Ce que tu peux faire"}
        </p>
        <div className="mt-3 border-t border-[var(--o-line)]">
          {levers.map((t, i) => (
            <div key={i} className="flex gap-4 border-b border-[var(--o-line)] py-4">
              <span className="text-[15px] font-extrabold tabular-nums text-[var(--o-muted)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="text-[15px] leading-relaxed">{t}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 pt-7">
        <Link
          href="/proto/aujourdhui"
          className="flex items-center justify-center border border-[var(--o-ink)] bg-[var(--o-ink)] py-3.5 text-[16px] font-bold text-[var(--o-bg)]"
        >
          {"J’ai compris"}
        </Link>
      </div>

      <BottomNav />
    </main>
  );
}
