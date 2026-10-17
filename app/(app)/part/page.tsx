"use client";

import { Suspense, useMemo } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Face, Ic, Money, Page as Ecran, Sec, Tip, eur } from "@/components/carnet/ui";
import { useDesk } from "@/components/bs/desk-hook";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";

/** Les frais partagés, expliqués une fois, avec les chiffres de l'écurie. */
export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <Part />
      </Suspense>
    </ClientGate>
  );
}

function Part() {
  const data = useDataStore();
  const capacity = useSettingsStore((s) => s.capacity);
  const desk = useDesk();
  const period = useMemo(() => currentPeriod(), []);
  const m = useMemo(() => monthBreakdown(data, period), [data, period]);
  const horses = data.horses.filter((h) => !h.isArchived);
  const n = horses.length || 1;
  const libres = Math.max(0, capacity - horses.length);
  const mois = new Date(period.year, period.month - 1, 1).toLocaleDateString("fr-FR", { month: "long" });
  const du = /^[aeiouyéèh]/i.test(mois) ? `d’${mois}` : `de ${mois}`;

  return (
    <Ecran wide={desk} className={desk ? "ch-desk ch-narrow" : undefined}>
      <div className="hello rise" style={{ animationDelay: ".04s" }}>
        <h2>Les frais partagés, c’est quoi&nbsp;?</h2>
        <p>Ce sont les dépenses qui servent à toute l’écurie (foin, paille, loyer, salaires…), pas à un cheval en particulier. Chaque cheval en paie un morceau : c’est sa part.</p>
      </div>
      <Sec ill="brouette" title={`Les frais partagés ${du}`} delay={0.12} />
      <div className="pad rise" style={{ animationDelay: ".18s", paddingTop: 12 }}>
        {m.shared.length === 0 ? (
          <p className="note">Aucun frais commun noté ce mois pour l’instant.</p>
        ) : (
          <div className="ticket ch-mini print">
            {m.shared.map((x) => (
              <div key={x.label} className="r">
                <span>{x.label}</span>
                <Money v={-x.amount} />
              </div>
            ))}
            <div className="r tot">
              <span>Total ce mois</span>
              <Money v={-m.sharedTotal} />
            </div>
          </div>
        )}
      </div>
      <div className="pad ch-sum rise" style={{ animationDelay: ".3s" }}>
        <div className="ch-down">
          <Ic n="arrow" className="" />
        </div>
        <div className="ch-heads" role="img" aria-label={`Les ${horses.length} chevaux`}>
          {horses.map((h) => (
            <Face key={h.id} horse={h} />
          ))}
        </div>
        <p className="ch-div">
          {horses.length
            ? `${eur(m.sharedTotal)} ÷ ${horses.length} ${horses.length > 1 ? "chevaux" : "cheval"} ≈ ${eur(m.sharedTotal / n)} chacun`
            : `Aucun cheval pour se partager ces ${eur(m.sharedTotal)} : ils comptent quand même dans ton mois.`}
        </p>
        {libres > 0 && (
          <>
            <div className="ch-heads" style={{ marginTop: 14 }} role="img" aria-label={`Les ${libres} boxes libres`}>
              {Array.from({ length: Math.min(libres, 24) }, (_, i) => (
                <span key={i} className="free" />
              ))}
            </div>
            <p className="ch-div" style={{ marginTop: 6 }}>
              <small>
                Si {libres > 1 ? `tes ${libres} boxes libres étaient pleins` : "ton box libre était plein"}, chacun paierait {eur(m.sharedTotal / capacity)}.
              </small>
            </p>
          </>
        )}
      </div>
      <div className="ch-after rise" style={{ animationDelay: ".4s" }}>
        <Tip>
          <b>Une pension doit payer au moins sa part et les soins du cheval.</b> Sinon, chaque mois, ce cheval te coûte de l’argent.
        </Tip>
      </div>
      <div className="end" />
    </Ecran>
  );
}
