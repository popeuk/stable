"use client";

import { useMemo } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen } from "@/components/bs/ui";
import { Hello, Ill, Money, Sec, type IllName } from "@/components/carnet/ui";
import { LigneComptee, useMaintenant } from "@/components/bs/compte";
import { useDataStore } from "@/stores/data-store";
import { ceQuiACompte } from "@/lib/domain/compte-auto";
import { addDays } from "@/components/bs/dates";

/**
 * Ce qui a compté : les 7 derniers jours, jour par jour. Ce qui était au
 * planning et dont l'heure est passée a compté tout seul ; ici, on retire
 * seulement ce qui n'a pas eu lieu (×). Un cours à plusieurs, ou une séance
 * sans montant, garde « Qui était là ? ». La route reste /valider pour les
 * liens existants. Style : app/carnet/journee.css et accueil2.css (cp-).
 */
export default function Page() {
  return (
    <ClientGate>
      <CeQuiACompte />
    </ClientGate>
  );
}

const VIGNETTES: IllName[] = ["confirmer", "gerant-buste", "foin", "gerant-foin"];

function CeQuiACompte() {
  const data = useDataStore();
  const { today, time } = useMaintenant();
  const jours = useMemo(() => ceQuiACompte(data, today, time, 7), [data, today, time]);
  const total = jours.reduce((t, j) => t + j.total, 0);
  const dayTitle = (d: string) => {
    const long = new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" });
    if (d === today) return `Aujourd’hui, ${long}`;
    if (d === addDays(today, -1)) return `Hier, ${long}`;
    const s = new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <Screen>
      <div className="jr-valider">
        <Hello title="Ce qui est fait." sub="Tout ce qui était prévu compte. Si quelque chose n’a pas eu lieu, retire la ligne." />
        <div className="pad rise" style={{ animationDelay: ".08s", marginTop: 8 }}>
          <div className="card jr-wait">
            <span>
              <span className="k">Ces 7 derniers jours</span>
              <b className="mid">{jours.length ? <Money v={total} /> : "0 €"}</b>
            </span>
          </div>
        </div>
        {jours.length === 0 && (
          <div className="empty rise" style={{ animationDelay: ".14s" }}>
            <Ill n="dodo" className="e-dodo" />
            <p style={{ margin: 0 }}>
              <b className="jr-ok">Rien de noté ces 7 derniers jours.</b>
              <br />
              Ce qui est au planning comptera tout seul, une fois passé.
            </p>
          </div>
        )}
        {jours.map((j, i) => (
          <Sec key={j.date} blk ill={VIGNETTES[i % VIGNETTES.length]} title={dayTitle(j.date)} action={<Money v={j.total} className="act" />} delay={0.14 + i * 0.06}>
            <div className="rows">
              {j.items.map((it) => (
                <LigneComptee key={it.key} it={it} />
              ))}
            </div>
          </Sec>
        ))}
        <div className="end" />
      </div>
    </Screen>
  );
}
