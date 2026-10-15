import Link from "next/link";
import { Empty, Hello, Ic, Page } from "@/components/carnet/ui";

export default function ScenariosPage() {
  return (
    <Page>
      <h1 className="ar-sr">Et si… ?</h1>
      <Hello title="Et si… ?" sub="Et si tu augmentais tes pensions ? Et si le foin coûtait moins cher ? Essaie un changement pour voir ce qu’il te resterait chaque mois. Rien n’est modifié dans tes vrais chiffres." />
      <Empty ill="piste">Tu n’as encore rien essayé.</Empty>
      <div className="pad rise" style={{ animationDelay: ".12s", marginTop: 12 }}>
        <Link href="/scenarios/nouveau" className="btn full">
          <Ic n="chart" className="" />
          Essayer un changement
        </Link>
      </div>
      <div className="end" />
    </Page>
  );
}
