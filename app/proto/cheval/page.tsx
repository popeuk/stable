import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TopBar, HorseLine, Tag } from "../_ui";
import { BottomNav } from "../_nav";
import { buildDemoData } from "@/lib/data/demo-data";
import { horsePnl } from "@/lib/domain/calculations";
import { currentPeriod } from "@/lib/utils/period";

function eur(n: number) {
  const v = new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n)));
  return `${n < 0 ? "−" : ""}${v} €`;
}

export default function ProtoCheval() {
  const data = buildDemoData();
  const period = currentPeriod();
  const ranked = data.horses
    .filter((h) => !h.isArchived)
    .map((h) => ({ horse: h, p: horsePnl(data, h.id, period) }))
    .sort((a, b) => a.p.netResult - b.p.netResult);
  const { horse, p } = ranked[0];
  const ok = p.netResult >= 0;
  const cover = p.threshold > 0 ? Math.min(1, p.revenue / p.threshold) : 1;

  return (
    <main className="mx-auto min-h-dvh max-w-[440px] pb-24">
      <TopBar />

      {/* En-tête image */}
      <div className="relative mx-5 mt-4 overflow-hidden border border-[var(--o-line-strong)]">
        <div
          className="proto-grain relative flex aspect-[16/10] items-center justify-center"
          style={{
            background:
              "linear-gradient(160deg, var(--o-yellow-2) 0%, var(--o-yellow) 100%)",
          }}
        >
          <HorseLine size={170} stroke={0.8} color="rgba(23,21,13,0.9)" />
          <div className="absolute left-3 top-3">
            <Link
              href="/proto/aujourdhui"
              className="flex size-8 items-center justify-center border border-[var(--o-ink)] bg-[var(--o-bg)]"
            >
              <ChevronLeft size={16} />
            </Link>
          </div>
          <div className="absolute bottom-3 right-3">
            <Tag tone={ok ? "green" : "red"}>{ok ? "Il rapporte" : "Il coûte"}</Tag>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4">
        <h1 className="text-[34px] font-extrabold leading-none">{horse.name}</h1>
        <p className="mt-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--o-muted)]">
          {`${horse.breed ?? ""}${horse.birthYear ? ` · ${new Date().getFullYear() - horse.birthYear} ans` : ""}`}
        </p>

        <p className="mt-5 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--o-muted)]">
          {"Ce qu’il te laisse ce mois"}
        </p>
        <p
          className="text-[50px] font-extrabold leading-none tabular-nums"
          style={{ color: ok ? "var(--o-green)" : "var(--o-red)" }}
        >
          {eur(p.netResult)}
        </p>
      </div>

      {/* Lignes fines, bien rangées */}
      <div className="mt-5 px-5">
        <Row label="Il fait rentrer" value={eur(p.revenue)} />
        <Row label="Il te coûte" value={eur(p.threshold)} />
        <Row label="Son seuil de rentabilité" value={eur(p.threshold)} last />
      </div>

      {/* Seuil */}
      <div className="mt-5 px-5">
        <div className="mb-1.5 flex justify-between text-[12px] font-semibold text-[var(--o-muted)]">
          <span>{"Sous le seuil"}</span>
          <span>{"À l’équilibre"}</span>
        </div>
        <div className="h-2 w-full border border-[var(--o-line-strong)] bg-[var(--o-paper)]">
          <div
            className="h-full"
            style={{ width: `${cover * 100}%`, background: ok ? "var(--o-green)" : "var(--o-red)" }}
          />
        </div>
      </div>

      {/* Copilote */}
      <div className="mt-5 px-5">
        <div className="proto-grain border border-[var(--o-ink)] bg-[var(--o-ink)] p-5 text-[var(--o-bg)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--o-yellow)]">
            {"Ton copilote"}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed">
            {ok
              ? `${horse.name} dégage ${eur(p.netResult)} ce mois. Solide — garde le cap.`
              : `${horse.name} te coûte ${eur(Math.abs(p.netResult))} de plus qu’il ne rapporte. Une légère hausse de pension le remettrait à flot.`}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 px-5">
        <Link
          href="/proto/lecon"
          className="flex items-center justify-center border border-[var(--o-line-strong)] py-3 text-[14px] font-bold"
        >
          {"Comprendre la marge"}
        </Link>
        <Link
          href="/proto/saisie"
          className="flex items-center justify-center border border-[var(--o-ink)] bg-[var(--o-yellow)] py-3 text-[14px] font-bold"
        >
          {"Tester une hausse"}
        </Link>
      </div>

      <BottomNav />
    </main>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between border-t border-[var(--o-line)] py-3.5 ${last ? "border-b" : ""}`}
    >
      <span className="text-[14px] text-[var(--o-muted)]">{label}</span>
      <span className="text-[16px] font-extrabold tabular-nums">{value}</span>
    </div>
  );
}
