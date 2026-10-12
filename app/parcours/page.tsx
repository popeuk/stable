"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSettingsStore } from "@/stores/settings-store";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen } from "@/components/bs/ui";
import { Picto } from "@/components/bs/picto";
import { OBSTACLE_META, useParcours } from "@/components/bs/parcours";
import { OBSTACLES } from "@/stores/settings-store";

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
    <Screen>
      <div className="bs-over" style={{ alignItems: "center" }}>
        <span>Tes premiers pas</span>
        <button type="button" className="bs-icon" onClick={sortir} aria-label={setupDone ? "Fermer et aller à l’accueil" : "Finir plus tard et découvrir l’app"} style={{ marginRight: -8 }}>
          <Picto name="x" />
        </button>
      </div>
      <h1 className="bs-d bs-t1">
        {n} obstacle{n > 1 ? "s" : ""} sur 6
      </h1>
      <p className="bs-p">Six étapes pour que l’app connaisse ton écurie. Les trois premières se font ici, en quelques minutes. Les trois autres viennent toutes seules, en utilisant l’app.</p>
      <div className="bs-progress">
        <i style={{ width: `${(n / 6) * 100}%` }} />
      </div>
      <div className="bs-course">
        {OBSTACLES.map((o) => {
          const m = OBSTACLE_META[o];
          const st = parcours[o] ? "done" : current === o ? "now" : "";
          const reachable = parcours[o] || st === "now" || (setupDone && ["journee", "ticket", "seuil"].includes(o));
          const inner = (
            <>
              <span className="jn">
                <Picto name={st === "done" ? "check" : m.picto} />
              </span>
              <div>
                <b>{m.title}</b>
                <span>{parcours[o] ? "barre passée" : m.todo}</span>
              </div>
            </>
          );
          return reachable ? (
            <Link key={o} href={m.href} className={`bs-ob ${st}`}>
              {inner}
            </Link>
          ) : (
            <div key={o} className={`bs-ob ${st}`}>
              {inner}
            </div>
          );
        })}
      </div>
      {current ? (
        <Link href={OBSTACLE_META[current].href} className="bs-card">
          <div style={{ flex: 1 }}>
            <div className="k">Obstacle du moment</div>
            <b>{OBSTACLE_META[current].todo}</b>
          </div>
          <Picto name="arrowR" />
        </Link>
      ) : (
        <Link href="/parcours/arrivee" className="bs-card">
          <div style={{ flex: 1 }}>
            <div className="k">Parcours terminé</div>
            <b>Voir ton flot</b>
          </div>
          <Picto name="arrowR" />
        </Link>
      )}
      {setupDone && current && <p className="bs-p" style={{ marginTop: 12 }}>Les dernières étapes se passent toutes seules, en utilisant l’app à ton rythme.</p>}
      {!setupDone && (
        <button type="button" className="bs-btn line" style={{ marginTop: 14 }} onClick={sortir}>
          Découvrir l’app d’abord, finir plus tard
        </button>
      )}
    </Screen>
  );
}
