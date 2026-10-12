import Link from "next/link";
import { TrendingUp, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function ScenariosPage() {
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-bricolage)] text-2xl text-primary">
          Et si… ?
        </h1>
        <Link
          href="/scenarios/nouveau"
          className="flex items-center gap-1 btn-primary px-3 py-1.5 text-[12px] font-bold text-[var(--on-accent)]"
        >
          <Plus size={14} /> Essayer
        </Link>
      </header>
      <EmptyState
        title="Tu n’as encore rien essayé."
        body="Et si tu augmentais tes pensions ? Et si le foin coûtait moins cher ? Essaie un changement pour voir ce qu’il te resterait chaque mois. Rien n’est modifié dans tes vrais chiffres."
        icon={<TrendingUp size={22} />}
        action={
          <Link
            href="/scenarios/nouveau"
            className="btn-primary px-5 py-2.5 text-sm font-bold text-[var(--on-accent)]"
          >
            Essayer un changement
          </Link>
        }
      />
    </div>
  );
}
