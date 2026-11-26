"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Ic, eur } from "@/components/carnet/ui";
import { useSettingsStore } from "@/stores/settings-store";
import { useDataStore } from "@/stores/data-store";
import { useBriques } from "@/components/bs/briques";
import { estOuverte } from "@/lib/briques";
import { jaugeFiche } from "@/lib/fiche-jauge";
import { aRepondu } from "@/lib/account/demandes";
import { compte, type Etape, type Point } from "@/lib/presence";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";
import { scene, usePresence } from "@/components/bs/presence";

/**
 * L'accueil des quatre parties (26 novembre 2026, maquette validée par
 * Samuel) : la fiche bestable.fr d'abord, en encart ; ce qui marche déjà
 * (on ouvre sur la fierté) ; puis un point par partie, qui mène à l'onglet.
 */
export function AccueilQuatre() {
  const gerant = useSettingsStore((s) => s.gerant);
  const { etat, fiche, etapes, demandes, repondues } = usePresence();
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
        <TroisPoints etapes={null} attente={0} />
      </>
    );

  const { n, total } = jaugeFiche(fiche);
  const pct = Math.round((n / total) * 100);
  const attente = demandes.filter((d) => !aRepondu(d, repondues)).length;
  const photo = fiche.photos[0]?.url;
  const fier = ceQuiMarche(etapes);

  return (
    <>
      <div className="pr-hello rise">
        <h1>{bonjour}</h1>
        <p>{fiche.en_attente ? "On vérifie que c’est bien ton écurie. Ce que tu remplis est gardé en attendant." : "Voici où en est ton écurie : te trouver, te choisir, te faire vivre."}</p>
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

      {fier && (
        <p className="q4-fier rise" style={{ animationDelay: ".14s" }}>
          <Ic n="ck" className="" />
          <span>
            <b>Ce qui marche déjà : </b>
            {fier.titre.charAt(0).toLowerCase() + fier.titre.slice(1)}.
          </span>
        </p>
      )}

      <TroisPoints etapes={etapes} attente={attente} />
      <div className="end" />
    </>
  );
}

/** Le premier point réussi de l'audit, dans l'ordre du cavalier : ce dont le gérant peut être fier. */
function ceQuiMarche(etapes: Etape[]): Point | null {
  for (const e of etapes) for (const p of e.points) if (p.etat === "ok") return p;
  return null;
}

const aFaire = (n: number) => (n === 0 ? "Rien à corriger pour l’instant" : n === 1 ? "1 chose à faire" : `${n} choses à faire`);

function TroisPoints({ etapes, attente }: { etapes: Etape[] | null; attente: number }) {
  const { etat } = useBriques();
  const argent = estOuverte(etat.argent);
  const data = useDataStore();
  const ready = useDataStore((s) => s.hydrated);
  const net = useMemo(() => (argent ? monthBreakdown(data, currentPeriod()).net : 0), [data, argent]);

  // Te trouver et Te choisir sont payants : sans eux, l'accueil ne donne pas le résultat de l'audit.
  const trouverOuvert = estOuverte(etat.trouver);
  const choisirOuvert = estOuverte(etat.choisir);
  const t = etapes ? compte(etapes[0]) : null;
  const c2 = etapes ? compte(etapes[1]) : null;
  const c3 = etapes ? compte(etapes[2]) : null;
  const nTrouver = t ? t.ko + t.mid : 0;
  const nChoisir = c2 && c3 ? c2.ko + c2.mid + c3.ko + c3.mid : 0;
  const sousTrouver = !trouverOuvert ? "Bientôt : l’audit de ta visibilité" : t ? aFaire(nTrouver) : "Dès que ta fiche est à ton nom";
  const sousChoisir = !choisirOuvert ? "Bientôt : ton offre face aux écuries autour" : !etapes ? "Ton offre face à ton département" : `${aFaire(nChoisir)} · ton prix face au département`;

  return (
    <div className="q4-points rise" style={{ animationDelay: ".18s" }}>
      {attente > 0 && (
        <Link href="/demandes" className="q4-pt c">
          <span className="ic">
            <Ic n="mail" className="" />
          </span>
          <span>
            <b>{attente > 1 ? `${attente} demandes attendent` : "1 demande attend"} ta réponse</b>
            <small>Un cavalier t’a écrit depuis ta fiche. Réponds vite : c’est souvent le premier qui répond qui est choisi.</small>
          </span>
          <Ic n="chev" className="q4-chev" />
        </Link>
      )}
      <Link href="/te-trouver" className="q4-pt t">
        <span className="ic">
          <Ic n="search" className="" />
        </span>
        <span>
          <b>Te trouver</b>
          <small>{sousTrouver}</small>
        </span>
        <Ic n={trouverOuvert ? "chev" : "lock"} className="q4-chev" />
      </Link>
      <Link href="/te-choisir" className="q4-pt c">
        <span className="ic">
          <Ic n="vitrine" className="" />
        </span>
        <span>
          <b>Te choisir</b>
          <small>{sousChoisir}</small>
        </span>
        <Ic n={choisirOuvert ? "chev" : "lock"} className="q4-chev" />
      </Link>
      <Link href="/argent" className="q4-pt v">
        <span className="ic">
          <Ic n="chart" className="" />
        </span>
        <span>
          <b>Te faire vivre</b>
          <small>{argent ? (net >= 0 ? "Ce qu’il te reste ce mois-ci" : "Ce qu’il te manque ce mois-ci") : "Bientôt : ce que te rapporte chaque client"}</small>
        </span>
        {argent && ready ? <span className={`v${net < 0 ? " ko" : ""}`}>{eur(Math.round(net))}</span> : <Ic n={argent ? "chev" : "lock"} className="q4-chev" />}
      </Link>
    </div>
  );
}
