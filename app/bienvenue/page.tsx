"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { CourseDrawing, Screen } from "@/components/bs/ui";
import { Picto } from "@/components/bs/picto";
import { useParcours } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * Le premier contact : la promesse, le parcours dessiné, et deux portes.
 * Partir de son écurie (vide) ou essayer avec l'écurie de démonstration.
 */
export default function BienvenuePage() {
  return (
    <ClientGate>
      <Bienvenue />
    </ClientGate>
  );
}

function Bienvenue() {
  const router = useRouter();
  const { n } = useParcours();
  const stableName = useSettingsStore((s) => s.stableName);
  const startEmpty = useDataStore((s) => s.startEmpty);
  const resetToDemo = useDataStore((s) => s.resetToDemo);
  const setIdentity = useSettingsStore((s) => s.setIdentity);

  return (
    <Screen>
      <div style={{ minHeight: "calc(100dvh - 90px)", display: "flex", flexDirection: "column" }}>
        <div className="bs-over">
          <span className="bs-wm">be stable</span>
          {n > 0 && <span>{stableName}</span>}
        </div>
        <div style={{ marginTop: 14 }}>
          <CourseDrawing done={n} />
        </div>
        <h1 className="bs-d bs-t1" style={{ textAlign: "center", marginTop: 6 }}>
          Ce que ton écurie te rapporte, en six obstacles.
        </h1>
        <p className="bs-p" style={{ textAlign: "center", marginTop: 10 }}>
          Be Stable te dit, chaque mois, ce que ton écurie te rapporte vraiment. Cheval par cheval. Pas de formulaire : chaque barre installe une partie de ton écurie.
        </p>
        <ul style={{ listStyle: "none", marginTop: 18 }}>
          {[
            ["check", "Tu notes ce que tu fais", "un soin, un cours, une facture, en dix secondes"],
            ["horse", "Be Stable range l’argent au bon cheval", "la pension, le maréchal, sa part de foin et de loyer"],
            ["bulb", "Tu sais qui rapporte, qui coûte", "et une idée concrète pour améliorer le mois"],
          ].map(([p, b, s]) => (
            <li key={b} className="bs-li">
              <span className="bs-pic soft">
                <Picto name={p} />
              </span>
              <span className="tx">
                <b>{b}</b>
                <span>{s}</span>
              </span>
            </li>
          ))}
        </ul>
        <div style={{ marginTop: "auto", paddingTop: 24 }}>
          {n > 0 ? (
            <Link href="/parcours" className="bs-btn">
              Reprendre mon parcours <Picto name="arrowR" />
            </Link>
          ) : (
            <>
              <button
                type="button"
                className="bs-btn"
                onClick={() => {
                  startEmpty();
                  setIdentity({ stableName: "Mon écurie" });
                  router.push("/parcours/chevaux");
                }}
              >
                Prendre le départ avec mon écurie <Picto name="arrowR" />
              </button>
              <button
                type="button"
                className="bs-btn line"
                style={{ marginTop: 8 }}
                onClick={() => {
                  resetToDemo();
                  setIdentity({ stableName: "Les Trois Pommiers" });
                  router.push("/parcours/chevaux");
                }}
              >
                Essayer avec une écurie de démonstration
              </button>
            </>
          )}
          <p className="bs-p" style={{ textAlign: "center", fontSize: 12.5, marginTop: 8 }}>
            Les trois premiers obstacles prennent cinq minutes. Tes données restent sur ton téléphone.
          </p>
        </div>
      </div>
    </Screen>
  );
}
