"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, TrendingUp, TrendingDown, Minus, Trash2, Pencil, Archive } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { Sparkline } from "@/components/ui/sparkline";
import { Explain } from "@/components/ed/explain";
import { CopiloteNote } from "@/components/ed/copilote";
import { HorseLine, Tag } from "@/components/ed/atoms";
import { useHorses } from "@/lib/hooks/use-horses";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { formatEur } from "@/lib/utils/format-currency";
import { dateInPeriod } from "@/lib/utils/period";

function eur(n: number) {
  const v = new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n)));
  return `${n < 0 ? "−" : ""}${v} €`;
}

function freqLabel(f: string) {
  return f === "monthly" ? "mensuel" : f === "quarterly" ? "trimestriel" : "annuel";
}

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
  const delRecRevenue = useDataStore((s) => s.deleteRecurringRevenue);
  const delRecExpense = useDataStore((s) => s.deleteRecurringExpense);
  const delRevenue = useDataStore((s) => s.deleteRevenue);
  const delDirect = useDataStore((s) => s.deleteDirectExpense);
  const archiveHorse = useDataStore((s) => s.archiveHorse);

  const idx = horses.findIndex((h) => h.horse.id === id);
  if (idx === -1) return <p className="text-secondary">Cheval introuvable.</p>;

  const recRevenues = (data.recurringRevenues ?? []).filter((r) => r.horseId === id);
  const recExpenses = (data.recurringExpenses ?? []).filter((r) => !r.isShared && r.horseId === id);

  const item = horses[idx];
  const { horse, pnl, trend, series } = item;
  const ok = pnl.netResult >= 0;
  const next = horses[(idx + 1) % horses.length];
  const prev = horses[(idx - 1 + horses.length) % horses.length];
  const cover = pnl.threshold > 0 ? Math.min(1, pnl.revenue / pnl.threshold) : 1;

  // Breakdowns.
  const revByCat = new Map<string, number>();
  for (const r of data.revenues) {
    if (r.horseId !== horse.id || !dateInPeriod(r.date, period)) continue;
    const name = data.revenueCategories.find((c) => c.id === r.categoryId)?.name ?? "Autre";
    revByCat.set(name, (revByCat.get(name) ?? 0) + r.amount);
  }
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
    .map((s) => ({ label: s.label, amount: s.allocations.find((a) => a.horseId === horse.id)?.allocatedAmount ?? 0 }))
    .filter((x) => x.amount > 0);

  const trendIcon =
    trend === "hausse" ? <TrendingUp size={15} /> : trend === "baisse" ? <TrendingDown size={15} /> : <Minus size={15} />;

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
      className="space-y-5"
    >
      <Link href="/ecurie" className="inline-flex items-center gap-1 text-sm text-tertiary">
        <ChevronLeft size={16} /> Mon écurie
      </Link>

      {/* Le pouls du cheval : la teinte de l'en-tête EST sa santé. */}
      <div className="grain relative overflow-hidden">
        <div
          aria-hidden
          className="pulse-field absolute inset-0"
          style={
            {
              "--pulse-a": ok ? "rgba(227, 165, 43, 0.28)" : "rgba(192, 67, 46, 0.20)",
              "--pulse-b": ok ? "rgba(124, 144, 112, 0.24)" : "rgba(201, 138, 22, 0.16)",
            } as React.CSSProperties
          }
        />
        <div className="relative flex aspect-[16/9] items-center justify-center">
          <HorseLine size={140} stroke={0.9} color="var(--text-primary)" />
          <div className="absolute bottom-3 right-3">
            <Tag tone={ok ? "green" : "red"}>{ok ? "Il rapporte" : "Il coûte"}</Tag>
          </div>
        </div>
      </div>

      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-primary">{horse.name}</h1>
          <p className="text-[13px] font-semibold uppercase tracking-wide text-tertiary">
            {horse.breed}
            {horse.birthYear ? ` · ${new Date().getFullYear() - horse.birthYear} ans` : ""}
            {horse.ownerName ? ` · ${horse.ownerName}` : ""}
          </p>
        </div>
        <Link
          href={`/saisie/cheval?edit=${horse.id}`}
          aria-label="Modifier"
          className="flex shrink-0 items-center gap-1.5 border border-[var(--border-strong)] px-2.5 py-1.5 text-[12px] font-bold text-primary"
        >
          <Pencil size={13} /> Modifier
        </Link>
      </header>

      {/* Hero */}
      <div>
        <Explain k="marge_nette" className="text-[11px] font-bold uppercase tracking-[0.08em] text-tertiary">
          Ce qu&apos;il te laisse ce mois
        </Explain>
        <p
          className="font-[family-name:var(--font-fraunces)] text-5xl tabular-nums"
          style={{ color: ok ? "var(--c-success)" : "var(--c-danger)" }}
        >
          {eur(pnl.netResult)}
        </p>
        <span
          className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold capitalize"
          style={{ color: trend === "hausse" ? "var(--c-success)" : trend === "baisse" ? "var(--c-danger)" : "var(--text-tertiary)" }}
        >
          {trendIcon}{" "}
          <Explain k="tendance" className="capitalize">
            {trend}
          </Explain>
        </span>
      </div>

      {/* Entre / sort */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-[var(--border-strong)] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-tertiary">Il fait rentrer</p>
          <p className="mt-1 text-[22px] font-extrabold tabular-nums text-primary">{eur(pnl.revenue)}</p>
        </div>
        <div className="border border-[var(--border-strong)] p-4">
          <Explain k="cout_direct" className="text-[11px] font-bold uppercase tracking-wide text-tertiary">
            Il te coûte
          </Explain>
          <p className="mt-1 text-[22px] font-extrabold tabular-nums text-primary">{eur(pnl.threshold)}</p>
        </div>
      </div>

      {/* Seuil */}
      <div className="border border-[var(--border-strong)] p-4">
        <Explain k="seuil_rentabilite" className="text-[13px] font-bold text-primary">
          Son seuil de rentabilité
        </Explain>
        <p className="mt-1 text-[13px] text-secondary">
          Pour être à l&apos;équilibre, il doit rapporter au moins {eur(pnl.threshold)}. Là :{" "}
          {eur(pnl.revenue)}.
        </p>
        <div className="mt-3 h-2 w-full border border-[var(--border-strong)] bg-base">
          <div className="h-full" style={{ width: `${cover * 100}%`, background: ok ? "var(--c-success)" : "var(--c-danger)" }} />
        </div>
      </div>

      {/* 12 mois */}
      <div className="border border-[var(--border-strong)] p-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-tertiary">12 derniers mois</p>
        <Sparkline data={series} area width={380} height={72} className="w-full" />
      </div>

      {/* Copilote */}
      <CopiloteNote>
        {ok
          ? `${horse.name} dégage ${eur(pnl.netResult)} ce mois. Solide — garde le cap.`
          : `${horse.name} te coûte ${eur(Math.abs(pnl.netResult))} de plus qu'il ne rapporte. Le bon réflexe : alléger ses postes les plus lourds, puis réaligner sa pension à la prochaine échéance — sans geste brusque.`}
      </CopiloteNote>

      {/* Récurrents de ce cheval (pension, charges) */}
      {(recRevenues.length > 0 || recExpenses.length > 0) && (
        <div>
          <p className="text-[13px] font-bold uppercase tracking-wide text-tertiary">Récurrents</p>
          <ul className="mt-2 border-t border-[var(--border-default)]">
            {recRevenues.map((r) => (
              <li key={r.id} className="flex items-center gap-3 border-b border-[var(--border-default)] py-2.5">
                <span className="flex-1 text-[14px] text-primary">
                  {r.label ?? "Pension"}{" "}
                  <span className="text-[12px] text-tertiary">
                    · {freqLabel(r.frequency)} · revenu
                  </span>
                </span>
                <span className="text-[14px] font-bold tabular-nums" style={{ color: "var(--c-success)" }}>
                  +{formatEur(r.amount)}
                </span>
                <button
                  onClick={() => confirm("Arrêter ce revenu récurrent ?") && delRecRevenue(r.id)}
                  aria-label="Arrêter"
                  className="text-tertiary hover:text-[var(--c-danger)]"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
            {recExpenses.map((r) => (
              <li key={r.id} className="flex items-center gap-3 border-b border-[var(--border-default)] py-2.5">
                <span className="flex-1 text-[14px] text-primary">
                  {r.label}{" "}
                  <span className="text-[12px] text-tertiary">· {freqLabel(r.frequency)} · charge</span>
                </span>
                <span className="text-[14px] font-bold tabular-nums text-primary">
                  −{formatEur(r.amount)}
                </span>
                <button
                  onClick={() => confirm("Arrêter cette charge récurrente ?") && delRecExpense(r.id)}
                  aria-label="Arrêter"
                  className="text-tertiary hover:text-[var(--c-danger)]"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mouvements ponctuels du mois — corrigeables sur place */}
      {movements.length > 0 && (
        <div>
          <p className="text-[13px] font-bold uppercase tracking-wide text-tertiary">
            Ses mouvements ce mois
          </p>
          <ul className="mt-2 border-t border-[var(--border-default)]">
            {movements.map((m) => (
              <li key={m.id} className="flex items-center gap-3 border-b border-[var(--border-default)] py-2.5">
                <span className="w-11 shrink-0 text-[11px] font-semibold text-tertiary">
                  {m.date.slice(8, 10)}/{m.date.slice(5, 7)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] text-primary">{m.label}</span>
                <span
                  className="text-[14px] font-bold tabular-nums"
                  style={{ color: m.isIn ? "var(--c-success)" : "var(--text-primary)" }}
                >
                  {m.isIn ? "+" : "−"}
                  {formatEur(m.amount)}
                </span>
                <button
                  onClick={() =>
                    confirm(`Supprimer « ${m.label} » (${formatEur(m.amount)}) ?`) &&
                    (m.isIn ? delRevenue(m.id) : delDirect(m.id))
                  }
                  aria-label="Supprimer"
                  className="text-tertiary hover:text-[var(--c-danger)]"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Part mutualisée */}
      {sharedContrib.length > 0 && (
        <div>
          <Explain k="charges_mutualisees" className="text-[13px] font-bold uppercase tracking-wide text-tertiary">
            Sa part des charges partagées
          </Explain>
          <ul className="mt-2 border-t border-[var(--border-default)]">
            {sharedContrib.map((c) => (
              <li key={c.label} className="flex justify-between border-b border-[var(--border-default)] py-2.5 text-[14px]">
                <span className="text-secondary">{c.label}</span>
                <span className="font-bold tabular-nums text-primary">{formatEur(c.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/saisie?kind=revenu&horse=${horse.id}`}
          className="flex items-center justify-center border border-[var(--border-strong)] py-3 text-[14px] font-bold text-primary"
        >
          Ajouter un revenu
        </Link>
        <Link
          href={`/saisie?kind=charge&horse=${horse.id}`}
          className="flex items-center justify-center border border-[var(--text-primary)] bg-[var(--accent-primary)] py-3 text-[14px] font-bold text-[#17150d]"
        >
          Ajouter une charge
        </Link>
      </div>

      {!horse.isArchived && (
        <button
          onClick={() => {
            if (
              confirm(
                `${horse.name} quitte l'écurie ? Il sera archivé — ses chiffres restent dans ton historique.`,
              )
            ) {
              archiveHorse(horse.id);
              router.push("/ecurie");
            }
          }}
          className="flex w-full items-center justify-center gap-2 border border-[var(--border-strong)] py-3 text-[13px] font-semibold text-tertiary"
        >
          <Archive size={15} /> {horse.name} quitte l&apos;écurie — archiver
        </button>
      )}

      <p className="text-center text-[12px] text-tertiary">Glisse pour passer à {next.horse.name} →</p>
    </motion.div>
  );
}
