"use client";

import { useMemo } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, esc } from "@/components/bs/ui";
import { useDesk } from "@/components/bs/desk-hook";
import { Hello, Ill, Ic, Money, Sec, sg, type IllName } from "@/components/carnet/ui";
import { LigneComptee, useMaintenant } from "@/components/bs/compte";
import { PlanningTaches, PlanningTachesHaut } from "@/components/bs/planning-taches";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { aValider, ceQuiACompte } from "@/lib/domain/compte-auto";
import { seanceAmount } from "@/lib/domain/seances";
import type { Seance } from "@/lib/domain/types";
import { addDays } from "@/components/bs/dates";
import { heure } from "@/lib/utils/heure";
import { vibrer } from "@/lib/utils/vibrer";

/**
 * À valider (27 novembre 2026, repris de l'app du Clos) : une séance ne
 * compte au décompte qu'une fois validée. Ici, les séances passées qui
 * attendent, jour par jour, les plus récentes d'abord : « Valider » d'un
 * geste, « Tout valider » pour un jour, « Qui était là ? » pour un cours à
 * plusieurs (la feuille de la séance). Puis ce qui est déjà fait ces 7
 * derniers jours, avec × pour retirer ce qui n'a pas eu lieu. La route reste
 * /valider pour les liens existants. Styles : app/carnet/journee.css (av-).
 */
export default function Page() {
  return (
    <ClientGate>
      <AValider />
    </ClientGate>
  );
}

const VIGNETTES: IllName[] = ["confirmer", "gerant-buste", "foin", "gerant-foin"];

function AValider() {
  const data = useDataStore();
  const desk = useDesk();
  const say = useUiStore((s) => s.say);
  const openSeance = useUiStore((s) => s.openSeance);
  const { today, time } = useMaintenant();
  const jours = useMemo(() => aValider(data, today, time), [data, today, time]);
  const faits = useMemo(() => ceQuiACompte(data, today, time, 7), [data, today, time]);
  const n = jours.reduce((t, j) => t + j.seances.length, 0);
  const total = jours.reduce((t, j) => t + j.total, 0);
  const fait = data.taskLists?.find((l) => l.isDone)?.id;
  const nTaches = (data.tasks ?? []).filter((t) => t.listId !== fait && !(t.kind === "rdv" && t.due && t.due.slice(0, 10) < today)).length;
  const nom = (id: string) => data.people?.find((p) => p.id === id)?.name ?? "";
  const dayTitle = (d: string) => {
    if (d === today) return "Aujourd’hui";
    if (d === addDays(today, -1)) return "Hier";
    const s = new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const montant = (s: Seance) => seanceAmount({ ...s, status: "done" });

  // Valider sans demander : tous les inscrits présents ; « Annuler » pendant quelques secondes.
  const valider = (ss: Seance[]) => {
    if (!ss.length) return;
    const st = useDataStore.getState();
    const snap = { seances: st.seances, revenues: st.revenues };
    st.validerSeances(ss.map((s) => s.id));
    vibrer();
    const somme = ss.reduce((t, s) => t + montant(s), 0);
    say(
      ss.length > 1
        ? `${ss.length} séances validées${somme ? `, <strong>${sg(somme)}</strong> au décompte` : ""}.`
        : `Validée : <strong>${esc(ss[0].title)}</strong>${somme ? `, ${sg(somme)}` : ""}.`,
      () => useDataStore.setState(snap),
    );
  };

  return (
    <Screen wide={desk}>
      {!desk && <PlanningTachesHaut value="valider" count={nTaches} aValider={n} />}
      <div className="jr-valider">
        {desk && (
          <div style={{ marginBottom: 12, maxWidth: 420 }}>
            <PlanningTaches value="valider" count={nTaches} aValider={n} />
          </div>
        )}
        <Hello
          title={n ? `${n} séance${n > 1 ? "s" : ""} à valider` : "Tout est validé"}
          sub={n ? "Une séance ne compte au décompte qu’une fois validée. Pas eu lieu ? Ouvre-la pour l’annuler." : "Les séances passées arriveront ici, à valider d’un geste."}
        />
        {n > 0 && (
          <div className="pad rise" style={{ animationDelay: ".08s", marginTop: 8 }}>
            <div className="card jr-wait">
              <span>
                <span className="k">Une fois tout validé</span>
                <b className="mid">
                  <Money v={total} />
                </b>
              </span>
            </div>
          </div>
        )}
        {jours.map((j, i) => {
          const simples = j.seances.filter((s) => s.participants.length <= 1);
          return (
            <Sec
              key={j.date}
              blk
              ill={VIGNETTES[i % VIGNETTES.length]}
              title={dayTitle(j.date)}
              action={
                simples.length > 1 ? (
                  <button type="button" className="av-tout" onClick={() => valider(simples)}>
                    Tout valider
                  </button>
                ) : undefined
              }
              delay={0.12 + i * 0.06}
            >
              <div className="rows">
                {j.seances.map((s) => {
                  const plusieurs = s.participants.length > 1;
                  const qui = s.participants.map((p) => nom(p.personId)).filter(Boolean);
                  const m = montant(s);
                  return (
                    <div key={s.id} className="row av-ligne">
                      <time>{heure(s.start)}</time>
                      <button type="button" className="jr-open" onClick={() => openSeance(s.id)} title="Ouvrir la séance">
                        <b>{s.title}</b>
                        <small>{qui.length ? qui.join(", ") : s.horseIds.length ? `${s.horseIds.length} cheva${s.horseIds.length > 1 ? "ux" : "l"}` : "Sans inscrit"}</small>
                      </button>
                      <span className="amt">{m ? sg(m) : ""}</span>
                      {plusieurs ? (
                        <button type="button" className="cp-valider line" onClick={() => openSeance(s.id)} aria-label={`Qui était là : ${s.title}`}>
                          Qui était là ?
                        </button>
                      ) : (
                        <button type="button" className="cp-valider" onClick={() => valider([s])} aria-label={`Valider : ${s.title}`}>
                          Valider
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {simples.length > 1 && simples.length < j.seances.length && (
                <p className="note av-note">« Tout valider » laisse de côté les cours à plusieurs : dis qui était là.</p>
              )}
            </Sec>
          );
        })}
        {n === 0 && (
          <div className="empty rise" style={{ animationDelay: ".14s" }}>
            <Ill n="dodo" className="e-dodo" />
            <p style={{ margin: 0 }}>
              <b className="jr-ok">Rien n’attend.</b>
              <br />
              Le décompte du mois est à jour.
            </p>
          </div>
        )}

        <h3 className="av-faits rise">
          <Ic n="ck" className="" />
          Déjà validé ces 7 derniers jours
        </h3>
        {faits.length === 0 && <p className="note pad">Rien de validé ces 7 derniers jours.</p>}
        {faits.map((j) => (
          <Sec key={j.date} blk title={dayTitle(j.date)} action={<Money v={j.total} className="act" />} delay={0.2}>
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
