import Link from "next/link";
import { ChevronRight, GraduationCap, PencilLine } from "lucide-react";
import { HorseLine, Horseshoe, Tag, SectionHead, ArrowDisc } from "../_ui";
import { BottomNav } from "../_nav";
import { buildDemoData } from "@/lib/data/demo-data";
import { stablePnl, horsePnl } from "@/lib/domain/calculations";
import { currentPeriod } from "@/lib/utils/period";
import { formatMonthName } from "@/lib/utils/format-date";

function eur(n: number) {
  const v = new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n)));
  return `${n < 0 ? "−" : ""}${v} €`;
}

export default function ProtoToday() {
  const data = buildDemoData();
  const period = currentPeriod();
  const pnl = stablePnl(data, period);
  const positive = pnl.netResult >= 0;

  const horses = data.horses
    .filter((h) => !h.isArchived)
    .map((h) => ({ horse: h, p: horsePnl(data, h.id, period) }))
    .sort((a, b) => b.p.netResult - a.p.netResult);
  const best = horses[0];
  const worst = horses[horses.length - 1];

  return (
    <main className="mx-auto min-h-dvh max-w-[440px] pb-24">
      {/* Header : salutation + période */}
      <header className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center border border-[var(--o-ink)]">
            <Horseshoe size={18} stroke={2} />
          </div>
          <div>
            <p className="text-[12px] text-[var(--o-muted)]">{"Bonjour"}</p>
            <p className="text-[15px] font-extrabold leading-none">{"Ton écurie"}</p>
          </div>
        </div>
        <Tag>{formatMonthName(period)}</Tag>
      </header>

      {/* Le point du jour — la voix du copilote, accompagnement */}
      <section className="px-5 pt-4">
        <div className="flex border border-[var(--o-line-strong)] bg-[var(--o-paper)]">
          <div className="flex-1 p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--o-muted)]">
              {"Le point du jour"}
            </p>
            <p className="mt-2 text-[17px] font-bold leading-snug">
              {`${worst.horse.name} mérite ton attention. ${best.horse.name}, lui, te porte ce mois.`}
            </p>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-[var(--o-muted)]">
              {"Ce mois, tu gardes"}
            </p>
            <p
              className="text-[34px] font-extrabold leading-none tabular-nums"
              style={{ color: positive ? "var(--o-green)" : "var(--o-red)" }}
            >
              {eur(pnl.netResult)}
            </p>
            <Link
              href="/proto/cheval"
              className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold"
            >
              {"Voir le détail"} <ChevronRight size={14} />
            </Link>
          </div>
          <div
            className="flex w-[104px] shrink-0 items-center justify-center border-l border-[var(--o-line-strong)]"
            style={{ background: "var(--o-yellow)" }}
          >
            <HorseLine size={78} stroke={1} color="var(--o-ink)" />
          </div>
        </div>
      </section>

      {/* Cartes — accès rapides illustrés */}
      <section className="grid grid-cols-3 gap-3 px-5 pt-4">
        <QuickCard href="/proto/cheval" label="Mes chevaux" tint="var(--o-blue)" icon={<HorseLine size={30} stroke={1.4} />} />
        <QuickCard href="/proto/lecon" label="Apprendre" tint="var(--o-rose)" icon={<GraduationCap size={28} strokeWidth={1.5} />} />
        <QuickCard href="/proto/saisie" label="Saisir" tint="var(--o-mint)" icon={<PencilLine size={26} strokeWidth={1.5} />} />
      </section>

      {/* Feature — simulateur */}
      <section className="px-5 pt-3">
        <Link
          href="/proto/cheval"
          className="proto-grain flex items-center justify-between border border-[var(--o-ink)] bg-[var(--o-ink)] p-4 text-[var(--o-bg)]"
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--o-yellow)]">
              {"Simulateur"}
            </p>
            <p className="mt-1 text-[16px] font-bold">{"Teste une hausse de pension"}</p>
          </div>
          <ArrowDisc size={42} />
        </Link>
      </section>

      {/* Tes chevaux — liste fine */}
      <section className="px-5 pt-6">
        <SectionHead title="Tes chevaux" action="Tout voir" />
        <ul className="border-t border-[var(--o-line)]">
          {horses.slice(0, 5).map((h, i) => {
            const ok = h.p.netResult >= 0;
            return (
              <li key={h.horse.id}>
                <Link
                  href="/proto/cheval"
                  className="flex items-center gap-4 border-b border-[var(--o-line)] py-3.5"
                >
                  <span className="w-7 text-[13px] font-bold tabular-nums text-[var(--o-muted)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1">
                    <p className="text-[16px] font-bold leading-tight">{h.horse.name}</p>
                    <p className="text-[12px] text-[var(--o-muted)]">
                      {ok ? "rapporte ce mois" : "te coûte ce mois"}
                    </p>
                  </div>
                  <span
                    className="text-[16px] font-extrabold tabular-nums"
                    style={{ color: ok ? "var(--o-green)" : "var(--o-red)" }}
                  >
                    {eur(h.p.netResult)}
                  </span>
                  <ChevronRight size={16} className="text-[var(--o-muted)]" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <BottomNav />
    </main>
  );
}

function QuickCard({
  href,
  label,
  tint,
  icon,
}: {
  href: string;
  label: string;
  tint: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex aspect-square flex-col justify-between border border-[var(--o-line-strong)] p-3"
      style={{ background: tint }}
    >
      <span className="text-[var(--o-ink)]">{icon}</span>
      <span className="text-[13px] font-bold leading-tight">{label}</span>
    </Link>
  );
}
