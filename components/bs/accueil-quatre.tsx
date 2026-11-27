"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { Ic, eur } from "@/components/carnet/ui";
import { useSettingsStore } from "@/stores/settings-store";
import { useDataStore } from "@/stores/data-store";
import { useBriques } from "@/components/bs/briques";
import { estOuverte } from "@/lib/briques";
import { dayItems } from "@/lib/domain/seances";
import { localToday } from "@/lib/utils/local-date";
import { heure } from "@/lib/utils/heure";
import { hasObjective } from "@/stores/settings-store";
import { objectifPct, phraseObjectif } from "@/lib/domain/objectif";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";
import { usePresence } from "@/components/bs/presence";
import { PhraseDuJour } from "@/components/da/phrase-du-jour";
import { AValiderCarte } from "@/components/da/a-valider";
import { useGrille } from "@/components/da/grille-audit";
import { noteDe, premiersGestes } from "@/lib/audit/grille";

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
        <Recaps />
      </>
    );

  return (
    <>
      <div className="pr-hello rise">
        <h1>{bonjour}</h1>
        {fiche.en_attente ? <p>On vérifie que c’est bien ton écurie. Ce que tu remplis est gardé en attendant.</p> : <PhraseDuJour />}
      </div>

      <Recaps />
    </>
  );
}

/** Dans l'ordre de l'accueil du Clos (27 novembre 2026) : l'objectif du mois, ce qui attend d'être validé, la journée, puis la visibilité. */
function Recaps() {
  return (
    <>
      <Rentabilite />
      <AValiderCarte />
      <RendezVous />
      <Visibilite />
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
  // Comme au Clos : les deux prochains de la journée, le reste est dans le Planning.
  const montres = items.filter((i) => !i.done).slice(0, 2);
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

/**
 * La visibilité : le volet « Te trouver » de la grille d'audit (27 novembre
 * 2026). On ouvre sur ce qui tient déjà, puis la note et le premier geste.
 */
function Visibilite() {
  const { etat } = useBriques();
  const ouverte = estOuverte(etat.trouver);
  const { lignes } = useGrille();
  const t = lignes.filter((l) => l.volet === "trouver");
  const n = noteDe(t);
  const fier = t.find((l) => l.r.points === 2);
  const geste = premiersGestes(t, 1)[0];
  return (
    <Carte titre="Ta visibilité" href="/te-trouver" lien="Voir ton audit" ouverte={ouverte} delay={0.18}>
      {!ouverte ? (
        <p className="q5-vide">Est-ce que les cavaliers tombent sur ton écurie quand ils cherchent une pension près de chez eux ?</p>
      ) : (
        <>
          {fier && (
            <p className="q4-fier" style={{ margin: 0 }}>
              <Ic n="ck" className="" />
              <span>
                <b>Ce qui tient : </b>
                {fier.r.constat.charAt(0).toLowerCase() + fier.r.constat.slice(1)}
              </span>
            </p>
          )}
          <div className="q5-net">
            <b>{n.points}</b>
            <small>
              sur {n.sur} pour te trouver{n.aMesurer ? ` · ${n.aMesurer} à mesurer` : ""}
            </small>
          </div>
          {geste && (
            <p className="q5-vide">
              <b>D’abord : </b>
              {geste.r.geste!.titre.charAt(0).toLowerCase() + geste.r.geste!.titre.slice(1)}.
            </p>
          )}
        </>
      )}
    </Carte>
  );
}
