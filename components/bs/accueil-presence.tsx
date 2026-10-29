"use client";

import Link from "next/link";
import { Ic } from "@/components/carnet/ui";
import { useSettingsStore } from "@/stores/settings-store";
import { jaugeFiche } from "@/lib/fiche-jauge";
import { aRepondu } from "@/lib/account/demandes";
import { prochaine } from "@/lib/presence";
import { Agir, CarteEtape, scene, usePresence } from "@/components/bs/presence";

/**
 * L'accueil de la présence en ligne (29 octobre 2026, maquette validée) : la
 * fiche du gérant d'abord (il vient souvent de bestable.fr pour elle), la
 * demande qui attend, ce qui est gratuit ; puis les trois étapes d'un cavalier
 * et une seule chose à faire maintenant. Rien de payant.
 */
export function AccueilPresence() {
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
      </>
    );

  const { n, total } = jaugeFiche(fiche);
  const pct = Math.round((n / total) * 100);
  const attente = demandes.filter((d) => !aRepondu(d, repondues)).length;
  const p = prochaine(etapes);
  const photo = fiche.photos[0]?.url;

  return (
    <>
      <div className="pr-hello rise">
        <h1>
          {bonjour} Ta fiche est <span className="pr-hl">à toi</span>.
        </h1>
        <p>{fiche.en_attente ? "On vérifie que c’est bien ton écurie. Ce que tu remplis est gardé en attendant." : "Elle est en ligne sur bestable.fr. Complète-la, réponds aux cavaliers, et regarde ce qu’on trouve sur toi."}</p>
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
              Modifier ma vitrine
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
        <Link href="/demandes" className={attente ? "hot" : undefined}>
          <b>{attente}</b>
          <small>{attente > 1 ? "demandes attendent ta réponse" : attente === 1 ? "demande attend ta réponse" : "demande en attente"}</small>
        </Link>
        <Link href="/ma-fiche">
          <b>{pct} %</b>
          <small>de ta fiche remplie</small>
        </Link>
      </div>
      <p className="pr-free rise" style={{ animationDelay: ".14s" }}>
        <Ic n="ck" className="" />
        <span>
          <b>Gratuit, sans limite :</b> ta vitrine, tes demandes, ton audit.
        </span>
      </p>

      <section className="pr-journey">
        <h2 className="rise" style={{ animationDelay: ".18s" }}>
          Ce que vit un cavalier, en <span className="pr-hl">trois</span> étapes.
        </h2>
        <p className="pr-lead rise" style={{ animationDelay: ".2s" }}>
          On a regardé ta fiche comme il la regarde. Là où ça coince, il passe à l’écurie suivante.
        </p>
        <div className="pr-stops">
          {etapes.map((e, i) => (
            <CarteEtape key={e.id} e={e} delay={0.24 + i * 0.06} />
          ))}
        </div>
      </section>

      {p && (
        <div className="pr-now rise" style={{ animationDelay: ".3s" }}>
          <span className="eyeb">À faire maintenant · 1 minute</span>
          <h3>{p.titre}</h3>
          <p>{p.pourquoi}</p>
          <Agir p={p} className="btn pr-rose full" />
        </div>
      )}
      {!p && (
        <div className="pr-now pr-now-ok rise" style={{ animationDelay: ".3s" }}>
          <span className="eyeb">Tout est en ordre</span>
          <h3>Ta fiche dit l’essentiel.</h3>
          <p>Pense à confirmer tes places chaque mois : la date montre aux cavaliers que l’info est à jour.</p>
        </div>
      )}
      <div className="end" />
    </>
  );
}
