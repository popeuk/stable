"use client";

import Link from "next/link";
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
  return (
    <Screen>
      <div className="bs-over">
        <span>Ton parcours</span>
        {setupDone && (
          <Link href="/aujourdhui" style={{ color: "var(--vert)", fontWeight: 500 }}>
            Ma journée
          </Link>
        )}
      </div>
      <h1 className="bs-d bs-t1">
        {n} obstacle{n > 1 ? "s" : ""} sur 6
      </h1>
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
      {setupDone && current && <p className="bs-p" style={{ marginTop: 12 }}>Les derniers obstacles se passent en utilisant l’app, à ton rythme.</p>}
    </Screen>
  );
}
