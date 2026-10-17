"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSettingsStore } from "@/stores/settings-store";
import { ClientGate } from "@/components/ui/client-gate";
import { Ic } from "@/components/carnet/ui";
import { OBSTACLE_META, useParcours } from "@/components/bs/parcours";
import { OBSTACLES } from "@/stores/settings-store";

/** Les pictos du parcours, dans le jeu d'icônes du carnet. */
const IC: Record<string, string> = { horse: "horse", euro: "euro", foin: "hay", cal: "cal", jump: "doc", flag: "flag" };

export default function Page() {
  return (
    <ClientGate>
      <Parcours />
    </ClientGate>
  );
}

function Parcours() {
  const { parcours, n, current, setupDone } = useParcours();
  const router = useRouter();
  const plusTard = useSettingsStore((s) => s.remettreParcours);
  const sortir = () => {
    if (!setupDone) plusTard();
    router.push("/accueil");
  };
  return (
    <>
      <div className="ar-over">
        <span>Tes premiers pas</span>
        <button type="button" className="x" onClick={sortir} aria-label={setupDone ? "Fermer et aller à l’accueil" : "Finir plus tard et découvrir l’app"}>
          <Ic n="x" className="" />
        </button>
      </div>
      <h1 className="ar-t1 rise">
        {n === 0 ? "Six étapes, trois ici." : `${n} étape${n > 1 ? "s" : ""} sur 6`}
      </h1>
      <p className="ar-sub rise" style={{ animationDelay: ".05s" }}>
        Six étapes pour que l’app connaisse ton écurie. Les trois premières se font ici, en quelques minutes. Les trois autres viennent toutes seules, en utilisant l’app.
      </p>
      <div className="bar ar-prog" role="progressbar" aria-valuemin={0} aria-valuemax={6} aria-valuenow={n} aria-label={`${n} étapes sur 6`}>
        <i style={{ width: `${(n / 6) * 100}%` }} />
      </div>
      <div className="ar-course rise" style={{ animationDelay: ".12s" }}>
        {OBSTACLES.map((o) => {
          const m = OBSTACLE_META[o];
          const st = parcours[o] ? "done" : current === o ? "now" : "";
          const reachable = parcours[o] || st === "now" || (setupDone && ["journee", "ticket", "seuil"].includes(o));
          const inner = (
            <>
              <span className="jn">
                <Ic n={st === "done" ? "ck" : IC[m.picto] ?? "flag"} className="" />
              </span>
              <span>
                <b>{m.title}</b>
                <small>{parcours[o] ? "barre passée" : m.todo}</small>
              </span>
            </>
          );
          return reachable ? (
            <Link key={o} href={m.href} className={`ar-ob ${st}`}>
              {inner}
            </Link>
          ) : (
            <div key={o} className={`ar-ob ${st || "next"}`}>
              {inner}
            </div>
          );
        })}
      </div>
      {current ? (
        <Link href={OBSTACLE_META[current].href} className="card ar-obc rise" style={{ animationDelay: ".2s" }}>
          <span style={{ flex: 1 }}>
            <span className="k">Étape du moment</span>
            <b>{OBSTACLE_META[current].todo}</b>
          </span>
          <Ic n="arrow" className="ar-ico" />
        </Link>
      ) : (
        <Link href="/parcours/arrivee" className="card ar-obc rise" style={{ animationDelay: ".2s" }}>
          <span style={{ flex: 1 }}>
            <span className="k">Parcours terminé</span>
            <b>Voir ton flot</b>
          </span>
          <Ic n="arrow" className="ar-ico" />
        </Link>
      )}
      {setupDone && current && (
        <>
          <p className="ar-sub" style={{ marginTop: 12 }}>Les dernières étapes se passent toutes seules, en utilisant l’app à ton rythme.</p>
          <Link href="/parcours/arrivee" className="ar-alt">
            Revoir ce qu’il te reste ce mois
          </Link>
        </>
      )}
      {!setupDone && (
        <button type="button" className="btn line ar-later" onClick={sortir}>
          Découvrir l’app d’abord, finir plus tard
        </button>
      )}
    </>
  );
}
