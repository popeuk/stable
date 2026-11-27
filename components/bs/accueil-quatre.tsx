"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { Ic, eur } from "@/components/carnet/ui";
import { useSettingsStore } from "@/stores/settings-store";
import { useDataStore } from "@/stores/data-store";
import { useBriques } from "@/components/bs/briques";
import { estOuverte } from "@/lib/briques";
import { jaugeFiche } from "@/lib/fiche-jauge";
import { dayItems } from "@/lib/domain/seances";
import { localToday } from "@/lib/utils/local-date";
import { heure } from "@/lib/utils/heure";
import { hasObjective } from "@/stores/settings-store";
import { objectifPct, phraseObjectif } from "@/lib/domain/objectif";
import { compte, type Etape, type Point } from "@/lib/presence";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";
import { scene, usePresence } from "@/components/bs/presence";
import { PhraseDuJour } from "@/components/da/phrase-du-jour";
import { aValider } from "@/lib/domain/compte-auto";

/**
 * L'accueil des cinq onglets (26 novembre 2026, décision de Samuel), dans
 * l'ordre : l'encart de la fiche bestable.fr, les rendez-vous du jour, où en
 * est l'objectif de rentabilité, puis la visibilité (en ouvrant sur ce qui
 * marche déjà). Chaque carte mène à son onglet.
 */
export function AccueilQuatre() {
  const gerant = useSettingsStore((s) => s.gerant);
  const { etat, fiche, etapes } = usePresence();
  const prenom = gerant.trim().split(/\s+/)[0];
  const bonjour = prenom ? `Bonjour ${prenom}.` : "Bonjour.";

  if (etat === "inconnu")
    return (
      <div className="pr-hello rise">
        <h1>{bonjour}</h1>
        <p>On ouvre ta fiche…</p>
      </div>
    );
  if (etat === "erreur")
    return (
      <div className="pr-hello rise">
        <h1>{bonjour}</h1>
        <p>bestable.fr ne répond pas pour le moment. Vérifie ta connexion internet, puis reviens.</p>
      </div>
    );
  if (etat === "aucune" || !fiche || !etapes)
    return (
      <>
        <div className="pr-hello rise">
          <h1>
            {bonjour} Ton écurie n’a pas encore sa <span className="pr-hl">fiche</span>.
          </h1>
          <p>Cherche ton écurie sur bestable.fr et mets-la à ton nom. Si elle n’y est pas, ajoute-la. C’est gratuit, sans commission.</p>
        </div>
        <div className="pr-pad rise" style={{ animationDelay: ".1s" }}>
          <Link href="/compte/inscription?retrouver=1" className="btn full">
            Trouver mon écurie
            <Ic n="arrow" className="" />
          </Link>
        </div>
        <Recaps etapes={null} />
      </>
    );

  const { n, total } = jaugeFiche(fiche);
  const pct = Math.round((n / total) * 100);
  const photo = fiche.photos[0]?.url;

  return (
    <>
      <div className="pr-hello rise">
        <h1>{bonjour}</h1>
        {fiche.en_attente ? <p>On vérifie que c’est bien ton écurie. Ce que tu remplis est gardé en attendant.</p> : <PhraseDuJour />}
      </div>

      <div className="pr-cover rise" style={{ animationDelay: ".06s" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo ?? scene("porte")} alt="" className={photo ? undefined : "pr-cover-ill"} />
        <div className="pr-cover-tx">
          <span className="k">
            <i className={fiche.en_attente ? "att" : undefined} />
            Ta fiche sur bestable.fr · {fiche.en_attente ? "en vérification" : "en ligne"}
          </span>
          <h2>{fiche.title || "Ton écurie"}</h2>
          <p>{[fiche.commune, fiche.departement].filter(Boolean).join(" · ")}</p>
          <div className="acts">
            <Link href="/ma-fiche" className="btn pr-white">
              Modifier ma fiche
            </Link>
            {fiche.url && (
              <a href={fiche.url} target="_blank" rel="noreferrer" className="btn pr-glass">
                <Ic n="eye" className="" />
                Voir en ligne
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="pr-qrow rise" style={{ animationDelay: ".1s" }}>
        <Link href="/ma-fiche">
          <b>{pct} %</b>
          <small>de ta fiche remplie</small>
        </Link>
        <Link href="/ma-fiche?partie=places">
          <b>{fiche.places_libres === "" ? "?" : fiche.places_libres === "0" ? "Complet" : fiche.places_libres}</b>
          <small>{fiche.places_libres === "" ? "places libres : à dire" : fiche.places_libres === "0" ? "aucune place libre" : Number(fiche.places_libres) > 1 ? "places libres" : "place libre"}</small>
        </Link>
      </div>

      <Recaps etapes={etapes} />
    </>
  );
}

/** Le premier point réussi de l'audit, dans l'ordre du cavalier : ce dont le gérant peut être fier. */
function ceQuiMarche(etapes: Etape[]): Point | null {
  for (const e of etapes) for (const p of e.points) if (p.etat === "ok") return p;
  return null;
}

const aFaire = (n: number) => (n === 0 ? "Rien à corriger pour l’instant" : n === 1 ? "1 chose à faire" : `${n} choses à faire`);

/** Les trois récaps, dans l'ordre de Samuel : la journée, la rentabilité, la visibilité. */
function Recaps({ etapes }: { etapes: Etape[] | null }) {
  return (
    <>
      <RendezVous />
      <AValiderCarte />
      <Rentabilite />
      <Visibilite etapes={etapes} />
      <div className="end" />
    </>
  );
}

/** Une carte de l'accueil : son titre, son contenu, et le lien vers son onglet. */
function Carte({ titre, href, lien, ouverte, children, delay, vert }: { titre: string; href: string; lien: string; ouverte: boolean; children: ReactNode; delay: number; vert?: boolean }) {
  return (
    <section className={`q5-carte rise${vert ? " da-carte-verte" : ""}`} style={{ animationDelay: `${delay}s` }}>
      <h2>{titre}</h2>
      {children}
      <Link href={href} className="q4-lk">
        {lien} <Ic n={ouverte ? "chev" : "lock"} className="" />
      </Link>
    </section>
  );
}

const maintenant = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Les rendez-vous du jour : séances, soins, tâches, triés par heure (le planning). */
function RendezVous() {
  const { etat } = useBriques();
  const ouverte = estOuverte(etat.planning);
  const data = useDataStore();
  const ready = useDataStore((s) => s.hydrated);
  const today = localToday();
  const items = useMemo(() => (ouverte && ready ? dayItems(data, today, today, maintenant()) : []), [data, today, ouverte, ready]);
  const montres = items.slice(0, 4);
  return (
    <Carte titre="Aujourd’hui" href="/planning" lien={items.length > montres.length ? `Les ${items.length} rendez-vous` : "Ouvrir le planning"} ouverte={ouverte} delay={0.1}>
      {!ouverte ? (
        <p className="q5-vide">Tes cours, stages, soins et tâches du jour, avec le planning.</p>
      ) : !ready ? (
        <p className="q5-vide">…</p>
      ) : montres.length === 0 ? (
        <p className="q5-vide">Rien de prévu aujourd’hui.</p>
      ) : (
        <ul className="q5-rdv">
          {montres.map((i) => (
            <li key={i.key} className={i.done ? "fait" : undefined}>
              <time>{i.start ? heure(i.start) : "Dans la journée"}</time>
              <span>
                <b>{i.title}</b>
                {i.sub && <small>{i.sub}</small>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Carte>
  );
}

/**
 * Ce qui attend d'être validé (DA de l'app du Clos) : une carte rose, le
 * nombre en grand, ce que ça ajoutera au décompte, et le chemin vers
 * Planning, À valider. Rien quand rien n'attend.
 */
function AValiderCarte() {
  const { etat } = useBriques();
  const ouverte = estOuverte(etat.planning);
  const data = useDataStore();
  const ready = useDataStore((s) => s.hydrated);
  const today = localToday();
  const jours = useMemo(() => (ouverte && ready ? aValider(data, today, maintenant()) : []), [data, today, ouverte, ready]);
  const n = jours.reduce((t, j) => t + j.seances.length, 0);
  const total = jours.reduce((t, j) => t + j.total, 0);
  if (!n) return null;
  return (
    <Link href="/valider" className="da-a-valider rise" style={{ animationDelay: ".12s" }}>
      <b>{n}</b>
      <span>
        <strong>séance{n > 1 ? "s" : ""} à valider</strong>
        <small>{total > 0 ? `+${eur(total)} au décompte une fois validée${n > 1 ? "s" : ""}` : "Dans le Planning, onglet À valider"}</small>
      </span>
      <Ic n="arrow" className="" />
    </Link>
  );
}

/** L'objectif de rentabilité : ce qu'il reste ce mois-ci, face à ce que le gérant vise. */
function Rentabilite() {
  const { etat } = useBriques();
  const ouverte = estOuverte(etat.argent);
  const data = useDataStore();
  const ready = useDataStore((s) => s.hydrated);
  const objective = useSettingsStore((s) => s.objective);
  const net = useMemo(() => (ouverte ? monthBreakdown(data, currentPeriod()).net : 0), [data, ouverte]);
  const pct = objectifPct(net, objective);
  return (
    <Carte titre="Ton objectif du mois" href={ouverte && !hasObjective(objective) ? "/argent?objectif=1" : "/argent"} lien={ouverte && !hasObjective(objective) ? "Te fixer un objectif" : "Voir ta rentabilité"} ouverte={ouverte} delay={0.14} vert={ouverte}>
      {!ouverte ? (
        <p className="q5-vide">Ce qu’il te reste à la fin du mois, face à ce que tu veux te verser.</p>
      ) : !ready ? (
        <p className="q5-vide">…</p>
      ) : (
        <>
          <div className="q5-net">
            <b className={net < 0 ? "ko" : undefined}>{eur(Math.round(net))}</b>
            <small>{net >= 0 ? "il te reste ce mois-ci" : "il te manque ce mois-ci"}</small>
            {pct !== null && <em>{Math.round(pct)} %</em>}
          </div>
          {pct !== null ? (
            <>
              <div className="q5-jauge" role="img" aria-label={`${Math.round(pct)} % de ton objectif`}>
                <span style={{ width: `${pct}%` }} />
              </div>
              <p className="q5-vide">{phraseObjectif(net, objective)}</p>
            </>
          ) : (
            <p className="q5-vide">Tu n’as pas encore d’objectif : combien veux-tu qu’il te reste chaque mois ?</p>
          )}
        </>
      )}
    </Carte>
  );
}

/** La visibilité : ce qui marche déjà (on ouvre sur la fierté), puis ce qu'il reste à faire. */
function Visibilite({ etapes }: { etapes: Etape[] | null }) {
  const { etat } = useBriques();
  const ouverte = estOuverte(etat.trouver);
  const t = etapes ? compte(etapes[0]) : null;
  const fier = etapes ? ceQuiMarche(etapes) : null;
  const premier = etapes?.[0]?.points.find((p) => p.etat === "ko") ?? etapes?.[0]?.points.find((p) => p.etat === "mid") ?? null;
  return (
    <Carte titre="Ta visibilité" href="/te-trouver" lien="Voir ta visibilité" ouverte={ouverte} delay={0.18}>
      {!ouverte ? (
        <p className="q5-vide">Est-ce que les cavaliers tombent sur ton écurie quand ils cherchent une pension près de chez eux ?</p>
      ) : !t ? (
        <p className="q5-vide">Dès que ta fiche est à ton nom.</p>
      ) : (
        <>
          {fier && (
            <p className="q4-fier" style={{ margin: 0 }}>
              <Ic n="ck" className="" />
              <span>
                <b>Ce qui marche déjà : </b>
                {fier.titre.charAt(0).toLowerCase() + fier.titre.slice(1)}.
              </span>
            </p>
          )}
          <p className="q5-vide">
            <b>{aFaire(t.ko + t.mid)}</b>
            {premier ? ` · d’abord : ${premier.titre.charAt(0).toLowerCase() + premier.titre.slice(1)}` : ""}
          </p>
        </>
      )}
    </Carte>
  );
}
