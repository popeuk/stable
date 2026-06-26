import Link from "next/link";
import { TrendingUp, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function ScenariosPage() {
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">
          Scénarios
        </h1>
        <Link
          href="/scenarios/nouveau"
          className="flex items-center gap-1 border border-[var(--text-primary)] bg-[var(--accent-primary)] px-3 py-1.5 text-[12px] font-bold text-[#17150d]"
        >
          <Plus size={14} /> Nouveau
        </Link>
      </header>
      <EmptyState
        title="Aucun scénario sauvegardé."
        body="Simule une hausse de pension ou un changement de charges, et garde le résultat sous la main."
        icon={<TrendingUp size={22} />}
        action={
          <Link
            href="/scenarios/nouveau"
            className="border border-[var(--text-primary)] bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-bold text-[#17150d]"
          >
            Créer un scénario
          </Link>
        }
      />
    </div>
  );
}
