"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ClientGate } from "@/components/ui/client-gate";
import { Explain } from "@/components/ed/explain";
import { Hello, Ic, Ill, Page, Sec, Tip, eur } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { useCoachStore } from "@/stores/coach-store";
import { useSettingsStore } from "@/stores/settings-store";
import { generateRecommendations } from "@/lib/domain/recommendations";
import { periodKey } from "@/lib/utils/period";
import { LESSON_KEYS } from "@/content/lessons";

const TOTAL_NOTIONS = LESSON_KEYS.length;

export default function PlanPage() {
  return (
    <ClientGate>
      <Plan />
    </ClientGate>
  );
}

function masteryLabel(score: number): string {
  if (score >= 16) return "Stratège";
  if (score >= 8) return "Pilote";
  if (score >= 3) return "Éclairé";
  return "Débutant";
}

function Plan() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const { actions, seenLessons, commit, complete, drop, reopen } = useCoachStore();
  const capacity = useSettingsStore((s) => s.capacity);

  const recos = useMemo(() => generateRecommendations(data, active, capacity), [data, active, capacity]);
  const engagedIds = new Set(actions.filter((a) => a.status === "engaged").map((a) => a.recoId));
  const toDecide = recos.filter((r) => !engagedIds.has(r.id));
  const engaged = actions.filter((a) => a.status === "engaged");
  const done = actions.filter((a) => a.status === "done");

  const notions = seenLessons.length;
  const decisions = done.length;
  const score = notions + decisions * 2;
  const gainSecured = done.reduce((s, a) => s + a.expectedImpact, 0);

  return (
    <Page>
      <h1 className="ar-sr">Mon plan</h1>
      <Hello title="Mon plan" sub="Ton copilote te propose, tu décides, il suit l’effet." />

      {/* Parcours de pilotage */}
      <div className="card ar-cardm ar-head rise" style={{ animationDelay: ".1s" }}>
        <Ill n="rosette" />
        <p className="k">Ton niveau de pilotage</p>
        <p className="mid" style={{ marginTop: 6 }}>
          {masteryLabel(score)}
        </p>
        <div className="trio">
          <div>
            <b>
              {notions}/{TOTAL_NOTIONS}
            </b>
            <small>notions comprises</small>
          </div>
          <div>
            <b>{decisions}</b>
            <small>décisions prises</small>
          </div>
          <div>
            <b>{eur(gainSecured)}</b>
            <small>gains visés</small>
          </div>
        </div>
      </div>

      {/* À décider */}
      <Sec ill="piste" title="À décider" delay={0.18}>
        {toDecide.length === 0 ? (
          <p className="note">Rien d’urgent à décider. Reviens après ta prochaine saisie.</p>
        ) : (
          toDecide.map((r) => (
            <div key={r.id} className="ar-pst">
              <span>
                <b>{r.title}</b>
                <p>
                  {r.why}
                  {r.lessonKey && (
                    <>
                      {" "}
                      <Explain k={r.lessonKey}>En savoir plus</Explain>
                    </>
                  )}
                </p>
              </span>
              <span className="ar-rt">
                {r.expectedImpact > 0 && (
                  <span className="in">
                    {r.impactKind === "potentiel" ? "≈ +" : "+"}
                    {eur(r.expectedImpact)}
                    <small>par mois</small>
                  </span>
                )}
              </span>
              <span className="ar-acts">
                {r.scenarioHref && (
                  <Link href={r.scenarioHref} className="lnk">
                    Tester
                  </Link>
                )}
                <button
                  type="button"
                  className="lnk"
                  onClick={() =>
                    commit({
                      recoId: r.id,
                      type: r.type,
                      title: r.title,
                      expectedImpact: r.expectedImpact,
                      relatedHorseId: r.relatedHorseId,
                      costPost: r.costPost,
                      periodKey: periodKey(active),
                    })
                  }
                >
                  Je m’y mets
                </button>
              </span>
            </div>
          ))
        )}
      </Sec>

      {/* En cours */}
      {engaged.length > 0 && (
        <Sec blk ill="carnet-buste" title="En cours" action={<span className="act">{engaged.length}</span>} delay={0.26}>
          {engaged.map((a) => (
            <div key={a.id} className="ar-pst">
              <span>
                <b>{a.title}</b>
                {a.expectedImpact > 0 && (
                  <p>
                    Effet visé : <span className="in">+{eur(a.expectedImpact)}</span> par mois
                  </p>
                )}
              </span>
              <span className="ar-rt">
                <span className="pill ar-ring">en cours</span>
              </span>
              <span className="ar-acts">
                <button type="button" className="lnk" onClick={() => complete(a.id)}>
                  C’est fait
                </button>
                <button type="button" className="lnk soft" onClick={() => drop(a.id)}>
                  Laisser tomber
                </button>
              </span>
            </div>
          ))}
        </Sec>
      )}

      {/* Fait */}
      {done.length > 0 && (
        <Sec ill="confirmer" title="Fait" action={<span className="act">{done.length}</span>} delay={0.34}>
          <Tip ill="rosette">
            <b>Bien joué.</b> Tu as pris {done.length} décision{done.length > 1 ? "s" : ""} pour {eur(gainSecured)} par mois visés. Surveille l’effet sur ta marge les prochains mois : c’est comme ça qu’on pilote.
          </Tip>
          {done.map((a) => (
            <div key={a.id} className="li">
              <span className="ar-pic">
                <Ic n="ck" className="ar-ic" />
              </span>
              <span style={{ color: "var(--ink2)", textDecoration: "line-through", textDecorationColor: "var(--line)" }}>{a.title}</span>
              <button type="button" className="lnk" onClick={() => reopen(a.id)} aria-label={`Rouvrir : ${a.title}`}>
                Rouvrir
              </button>
            </div>
          ))}
        </Sec>
      )}
      <div className="end" />
    </Page>
  );
}
