"use client";

import Link from "next/link";
import { Ic, Page } from "@/components/carnet/ui";
import { ClientGate } from "@/components/ui/client-gate";
import { Redirect } from "@/components/bs/redirect";
import { usePresence } from "@/components/bs/presence";
import { PanneauEtape } from "@/components/bs/etape-audit";
import { aRepondu } from "@/lib/account/demandes";
import { QUATRE_PARTIES } from "@/lib/fonctions";
import { OBSERVATOIRE_DATE } from "@/lib/observatoire-2026";
import { MIN_RELEVES, MOTS_PLACE, lirePrix, placeDe, secteurDe, surAxe, type Secteur } from "@/lib/prix-secteur";
import type { Fiche } from "@/lib/account/api";
import "@/app/carnet/presence.css";

/**
 * Te choisir (26 novembre 2026, les quatre parties) : l'offre de l'écurie,
 * comment le cavalier la voit, et où elle se place face aux pensions du
 * département (Observatoire Be Stable, lib/prix-secteur.ts). Puis les étapes
 * 2 et 3 de l'audit : ce qu'il lit sur la fiche, et ce qui se passe quand il
 * écrit.
 */
export default function TeChoisirPage() {
  if (!QUATRE_PARTIES) return <Redirect to="/audit?etape=2" />;
  return (
    <ClientGate>
      <TeChoisir />
    </ClientGate>
  );
}

const fmt = (n: number) => `${n.toLocaleString("fr-FR")} €`;

function TeChoisir() {
  const { etat, fiche, etapes, demandes, repondues } = usePresence();
  const pret = etat === "pret" && fiche && etapes;
  const attente = demandes.filter((d) => !aRepondu(d, repondues)).length;

  return (
    <Page className="pr-page">
      <div className="pr-hello rise">
        <span className="eyeb">Ton offre et ton secteur</span>
        <h2 className="q5-h">
          Ton <span className="pr-hl">offre</span>
        </h2>
        <p>Ce que le cavalier compare avant de t’écrire : ce que tu proposes, ton prix, et les écuries autour.</p>
      </div>

      {!pret ? (
        <>
          <p className="q4-bientot" style={{ margin: "14px 16px 0" }}>
            {etat === "inconnu" ? "On regarde ta fiche…" : etat === "erreur" ? "bestable.fr ne répond pas pour le moment. Réessaie dans un instant." : "Cette partie s’ouvre dès que ton écurie a sa fiche à ton nom."}
          </p>
          {etat === "aucune" && (
            <div className="pr-pad" style={{ marginTop: 14 }}>
              <Link href="/compte/inscription?retrouver=1" className="btn full">
                Trouver mon écurie
                <Ic n="arrow" className="" />
              </Link>
            </div>
          )}
        </>
      ) : (
        <>
          <Offre fiche={fiche} />

          <div className="q4-sec">
            <h2>Tes demandes</h2>
            <Link href="/demandes" className="q4-card" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="q4-funnel">
                <div>
                  <b>{demandes.length}</b>
                  <small>{demandes.length > 1 ? "demandes reçues" : "demande reçue"}</small>
                </div>
                <div>
                  <b>{attente}</b>
                  <small>{attente > 1 ? "attendent ta réponse" : "attend ta réponse"}</small>
                </div>
              </div>
              <span className="q4-lk">
                Voir mes demandes <Ic n="chev" className="" />
              </span>
            </Link>
            <p className="q4-src">Bientôt : noter si le cheval est arrivé, pour savoir combien de demandes deviennent une pension.</p>
          </div>

          <h2 className="q4-titre-etape">Ce qu’il lit sur ta fiche</h2>
          <div className="pr-panel">
            <PanneauEtape e={etapes[1]} />
          </div>
          <h2 className="q4-titre-etape">Quand il t’écrit</h2>
          <div className="pr-panel">
            <PanneauEtape e={etapes[2]} />
          </div>
        </>
      )}
      <div className="end" />
    </Page>
  );
}

/** Les pensions de la fiche, chacune face aux pensions du département. */
function Offre({ fiche }: { fiche: Fiche }) {
  const s = secteurDe(fiche.code_postal);
  const pensions = fiche.formules.filter((f) => f.nom.trim());
  const min = lirePrix(fiche.prix_min);
  const lignes = pensions.length ? pensions.map((f) => ({ nom: f.nom, description: f.description, prix: lirePrix(f.prix) })) : min ? [{ nom: "Pension, à partir de", description: "", prix: min }] : [];
  const comparable = s && s.releves >= MIN_RELEVES;

  return (
    <div className="q4-sec">
      <h2>Ton offre face à ton département</h2>
      {comparable && (
        <p>
          Dans ton département ({s.nom}), la moitié des pensions affichent un prix d’entrée entre {fmt(s.bas)} et {fmt(s.haut)} par mois.
        </p>
      )}
      <div className="q4-card">
        {lignes.length === 0 && <p style={{ margin: 0, fontSize: 14 }}>Ta fiche n’affiche pas encore de prix. Le cavalier compare sans appeler : sans prix, il passe souvent à l’écurie suivante.</p>}
        {lignes.map((l) => (
          <Ligne key={l.nom} nom={l.nom} description={l.description} prix={l.prix} s={comparable ? s : null} />
        ))}
        <Link href="/ma-fiche?partie=places" className="q4-lk">
          Modifier mes formules et mes prix <Ic n="chev" className="" />
        </Link>
      </div>
      <p className="q4-src">
        {s ? (
          <>
            Prix d’entrée des pensions du département, toutes formules confondues, relevés sur bestable.fr ({s.releves} prix, {OBSERVATOIRE_DATE}). Une pension travail coûte logiquement plus qu’une pension au pré.{" "}
            {!comparable && "Trop peu de prix relevés dans ton département pour comparer sans se tromper. "}
            <a href="https://bestable.fr/prix-pension-cheval/" target="_blank" rel="noreferrer">
              Observatoire Be Stable des prix
            </a>
          </>
        ) : (
          "L’Observatoire Be Stable n’a pas encore de prix pour ton département."
        )}
      </p>
    </div>
  );
}

function Ligne({ nom, description, prix, s }: { nom: string; description?: string; prix: number | null; s: Secteur | null }) {
  const place = prix && s ? placeDe(prix, s) : null;
  const axe = prix && s ? surAxe(prix, s) : null;
  return (
    <div className="q4-of">
      <div className="q4-row">
        <b>{nom}</b>
        <span className="p">{prix ? fmt(prix) : "Prix non affiché"}</span>
      </div>
      {description && <small>{description}</small>}
      {s && prix && axe && place && (
        <>
          <div className="q4-rng" aria-hidden="true">
            <span className="tr" />
            <span className="z" style={{ left: `${axe.pct(s.bas)}%`, width: `${axe.pct(s.haut) - axe.pct(s.bas)}%` }} />
            <span className="m" style={{ left: `${axe.pct(s.mediane)}%` }} />
            <span className="d" style={{ left: `${axe.pct(prix)}%` }} />
          </div>
          <span className={`pl ${place}`}>{MOTS_PLACE[place]}</span>
        </>
      )}
    </div>
  );
}
