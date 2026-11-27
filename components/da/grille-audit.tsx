"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Ic } from "@/components/carnet/ui";
import { usePresence } from "@/components/bs/presence";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { GRILLE, QUESTIONS_VIVRE, VOLETS, noteDe, premiersGestes, resultats, type Ligne, type Pts, type VoletKey } from "@/lib/audit/grille";

/**
 * L'audit sur grille fixe (27 novembre 2026, repris de l'app du Clos,
 * ~/Dreadsprint-v2/components/BilanLayer.tsx) : trois volets de dix critères,
 * chacun noté 2, 1 ou 0 selon une règle écrite, ou « à mesurer » quand on ne
 * l'a pas lu. Te trouver vit dans Visibilité, Te choisir dans Offre, En vivre
 * dans Rentabilité. Styles : app/da.css (.au-).
 */

const COUL: Record<Pts, "ok" | "mid" | "ko"> = { 2: "ok", 1: "mid", 0: "ko" };
const OU: Record<VoletKey, string> = { trouver: "/te-trouver", choisir: "/te-choisir", vivre: "/en-vivre" };

/** Les 30 lignes de l'audit, lues sur la fiche, les demandes et les données de l'écurie. */
export function useGrille(): { lignes: Ligne[]; pret: boolean; aFiche: boolean } {
  const { etat, fiche, demandes, repondues } = usePresence();
  const data = useDataStore();
  const capacity = useSettingsStore((s) => s.capacity);
  const objective = useSettingsStore((s) => s.objective);
  const objectiveCa = useSettingsStore((s) => s.objectiveCa);
  const lignes = useMemo(() => resultats({ fiche: etat === "pret" ? fiche : null, demandes, repondues, data, capacity, objective, objectiveCa }), [etat, fiche, demandes, repondues, data, capacity, objective, objectiveCa]);
  return { lignes, pret: etat !== "inconnu", aFiche: etat === "pret" && !!fiche };
}

function Cases({ lignes, grand }: { lignes: Ligne[]; grand?: boolean }) {
  return (
    <span className={`au-cases${grand ? " grand" : ""}`} aria-hidden="true">
      {lignes.map((l) => (
        <i key={l.id} className={l.r.points == null ? "na" : COUL[l.r.points]} />
      ))}
    </span>
  );
}

/** Les trois volets en un coup d'œil ; celui de la page est mis en avant, les autres y mènent. */
export function VueEnsemble({ lignes, ici }: { lignes: Ligne[]; ici?: VoletKey }) {
  const tient = lignes.filter((l) => l.r.points === 2).length;
  const n = noteDe(lignes);
  return (
    <section className="au-vue" aria-label="Ton audit en un coup d’œil">
      <p className="au-vue-phrase">
        <b>
          {tient} critère{tient > 1 ? "s" : ""} sur {lignes.length}
        </b>{" "}
        tiennent déjà.{n.aMesurer ? ` ${n.aMesurer} restent à mesurer.` : ""}
      </p>
      {VOLETS.map((v) => {
        const l = lignes.filter((x) => x.volet === v.key);
        const nv = noteDe(l);
        const contenu = (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.image} alt="" />
            <span className="au-vl-t">
              <b>{v.titre}</b>
              <Cases lignes={l} />
            </span>
            <span className="au-vl-n">
              <b>{nv.sur ? nv.points : "?"}</b>
              <small>{nv.sur ? `sur ${nv.sur}` : "à mesurer"}</small>
            </span>
          </>
        );
        return v.key === ici ? (
          <div key={v.key} className="au-vl on" aria-current="true">
            {contenu}
          </div>
        ) : (
          <Link key={v.key} href={OU[v.key]} className="au-vl">
            {contenu}
          </Link>
        );
      })}
      <p className="au-legende">
        <span>
          <i className="ok" />
          ça tient
        </span>
        <span>
          <i className="mid" />à revoir
        </span>
        <span>
          <i className="ko" />à corriger
        </span>
        <span>
          <i className="na" />à mesurer
        </span>
      </p>
    </section>
  );
}

/** Les gestes qui rapportent le plus de points dans un volet. */
export function Gestes({ lignes, titre = "Tes premiers gestes" }: { lignes: Ligne[]; titre?: string }) {
  const g = premiersGestes(lignes);
  if (!g.length) return null;
  return (
    <section className="au-gestes" aria-label={titre}>
      <h2>{titre}</h2>
      {g.map((l) => (
        <article key={l.id} className="au-geste">
          <div>
            <b>{l.r.geste!.titre}</b>
            <small>
              {l.r.geste!.qui} · {l.r.geste!.effort}
            </small>
          </div>
          <em>+{2 - (l.r.points as number)}</em>
        </article>
      ))}
    </section>
  );
}

/** Un volet en détail : la note, puis les critères rangés du plus urgent à ce qui tient. */
export function VoletDetail({ k, lignes, id }: { k: VoletKey; lignes: Ligne[]; id?: string }) {
  const v = VOLETS.find((x) => x.key === k)!;
  const l = lignes.filter((x) => x.volet === k);
  const n = noteDe(l);
  const groupes = [
    { t: "À corriger", c: "ko", l: l.filter((x) => x.r.points === 0) },
    { t: "À revoir", c: "mid", l: l.filter((x) => x.r.points === 1) },
    { t: "À mesurer", c: "na", l: l.filter((x) => x.r.points == null) },
    { t: "Ça tient", c: "ok", l: l.filter((x) => x.r.points === 2) },
  ].filter((g) => g.l.length);
  return (
    <section className="au-volet" aria-label={v.titre} id={id}>
      <header className="au-v-tete">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={v.image} alt="" />
        <div>
          <h2>{v.titre}</h2>
          <p className="au-v-scene">{v.scene}</p>
          <p className="au-v-note">
            {n.sur ? (
              <>
                <b>{n.points}</b> sur {n.sur}
                {n.aMesurer ? <small> · {n.aMesurer} à mesurer</small> : null}
              </>
            ) : (
              <small>Rien de mesuré pour l’instant : {n.aMesurer} critères à mesurer.</small>
            )}
          </p>
          <Cases lignes={l} grand />
        </div>
      </header>
      {groupes.map((g) => (
        <div key={g.t} className="au-groupe">
          <h3 className={g.c}>
            <i />
            {g.t} <span>{g.l.length}</span>
          </h3>
          {g.l.map((x) => (
            <CritereLigne key={x.id} l={x} />
          ))}
        </div>
      ))}
      <div className="au-nesait">
        <b>Ce que ce volet ne voit pas</b>
        <ul>
          {v.neSaitPas.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <small>Lu : {v.source}.</small>
      </div>
    </section>
  );
}

function CritereLigne({ l }: { l: Ligne }) {
  const p = l.r.points;
  const num = GRILLE.filter((c) => c.volet === l.volet).findIndex((c) => c.id === l.id) + 1;
  return (
    <details className={`au-c ${p == null ? "na" : COUL[p]}`}>
      <summary>
        <span className="au-c-n">{num}</span>
        <span className="au-c-t">
          <b>{l.titre}</b>
          <small>{l.r.constat}</small>
        </span>
        <span className="au-c-p">
          {p == null ? "?" : p}
          <small>{p == null ? "" : "/2"}</small>
        </span>
      </summary>
      <div className="au-c-corps">
        {l.r.vu && l.r.vu.length > 0 && (
          <div className="au-c-bloc">
            <h4>Ce qu’on a vu</h4>
            <ul className="au-vu">
              {l.r.vu.map((x, i) => (
                <li key={i} className={x.mauvais ? "mauvais" : ""}>
                  <span>{x.ou}</span>
                  <b>{x.valeur}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="au-c-bloc">
          <h4>Pourquoi ça compte</h4>
          <p>{l.pourquoi}</p>
        </div>
        <div className="au-c-bloc">
          <h4>La règle</h4>
          <ul className="au-regle">
            {([2, 1, 0] as Pts[]).map((x) => (
              <li key={x} className={p === x ? `on ${COUL[x]}` : ""}>
                <em>{x}</em>
                <span>{l.regle[x]}</span>
              </li>
            ))}
          </ul>
          <small className="au-mesure">Mesuré : {l.mesure}</small>
        </div>
        {l.volet === "vivre" && QUESTIONS_VIVRE[l.id] ? <Reponse id={l.id} question={QUESTIONS_VIVRE[l.id]} /> : l.r.question ? <p className="au-c-q">{l.r.question}</p> : null}
        {l.r.geste && p != null && p < 2 && (
          <p className="au-c-geste">
            <Ic n="arrow" className="" />
            <span>
              <b>{l.r.geste.titre}</b>
              <small>
                {l.r.geste.qui} · {l.r.geste.effort}
              </small>
            </span>
          </p>
        )}
      </div>
    </details>
  );
}

/** Ta réponse à une question qu'on ne voit pas de l'extérieur : gardée avec les données de l'écurie. */
function Reponse({ id, question }: { id: string; question: string }) {
  const enregistree = useDataStore((s) => s.reponsesAudit?.[id] ?? "");
  const setReponse = useDataStore((s) => s.setReponseAudit);
  const say = useUiStore((s) => s.say);
  const [v, setV] = useState(enregistree);
  return (
    <div className="au-rep">
      <label className="field">
        <span>{question}</span>
        <textarea className="input ta" rows={2} value={v} onChange={(e) => setV(e.target.value)} />
      </label>
      <button
        type="button"
        className="btn line"
        disabled={v.trim() === enregistree}
        onClick={() => {
          setReponse(id, v);
          say("C’est noté. Ta réponse comptera au prochain audit complet.");
        }}
      >
        Enregistrer
      </button>
    </div>
  );
}
