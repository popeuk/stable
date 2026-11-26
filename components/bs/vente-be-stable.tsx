"use client";

import type { ReactNode } from "react";
import { Ic } from "@/components/carnet/ui";
import { withBase } from "@/components/bs/ui";
import { useBriques } from "@/components/bs/briques";
import { PRIX_MOIS, type EtatBrique } from "@/lib/briques";
import "@/app/carnet/vente.css";

/**
 * La page d'abonnement des parties payantes (26 novembre 2026, les quatre
 * parties) : Te trouver, Te choisir, Te faire vivre. Son but : donner envie
 * de s'abonner. Une grande scène en papier qui dit le résultat, le prix tout
 * de suite, puis l'écran tel qu'il sera une fois ouvert (marqué « Exemple »),
 * ce que le gérant y gagne, et tout ce que comprend l'abonnement unique.
 */
export type Partie = "trouver" | "choisir" | "vivre";

const SCENE: Record<Partie, string> = {
  trouver: "/img/presence/google.webp",
  choisir: "/img/presence/choisit.webp",
  vivre: "/img/carnet/sacoche.webp",
};

const TEXTES: Record<Partie, { eyeb: string; titre: ReactNode; sous: string; gains: [string, string][] }> = {
  trouver: {
    eyeb: "Te trouver",
    titre: (
      <>
        Les cavaliers <span className="vb-hl">te trouvent</span>.
      </>
    ),
    sous: "Ce qu’un cavalier voit de toi quand il cherche une pension près de chez lui, et ce qu’il faut faire d’abord pour qu’il tombe sur ton écurie.",
    gains: [
      ["search", "Ton audit de visibilité, point par point : ce qui va, ce qui manque, pourquoi ça compte."],
      ["ck", "Une seule chose à faire à la fois, dans le bon ordre, avec le bouton qui la règle."],
      ["globe", "Ton site, fait à partir de ta fiche, pour qu’on te trouve aussi en dehors de bestable.fr."],
    ],
  },
  choisir: {
    eyeb: "Te choisir",
    titre: (
      <>
        Les cavaliers <span className="vb-hl">te choisissent</span>.
      </>
    ),
    sous: "Ton offre comme la voit le cavalier qui compare deux ou trois écuries : tes formules, tes prix face à ton département, ce qui le décide à t’écrire.",
    gains: [
      ["euro", "Chaque formule placée face aux prix des pensions de ton département, d’après l’Observatoire Be Stable."],
      ["eye", "Ce que le cavalier lit sur ta fiche avant d’écrire, et ce qui le fait passer à l’écurie suivante."],
      ["mail", "Tes demandes suivies, de la première question au cheval qui arrive."],
    ],
  },
  vivre: {
    eyeb: "Te faire vivre",
    titre: (
      <>
        Ton écurie <span className="vb-hl">te fait vivre</span>.
      </>
    ),
    sous: "Ce que te rapporte chaque cheval et chaque client, ce qu’il te reste à la fin du mois, et les pistes pour gagner plus, avec leurs conditions.",
    gains: [
      ["chart", "Ton bilan du mois en un coup d’œil, et ce qu’il te manque pour ton objectif."],
      ["people", "Ce que chaque client te rapporte vraiment, frais de ses chevaux compris."],
      ["cal", "Ton planning : cours, stages, soins et équipe, qui comptent tout seuls dans ton bilan."],
    ],
  },
};

/** Ce que comprend l'abonnement unique, dans l'ordre de l'app. */
const TOUT: [string, string][] = [
  ["search", "Te trouver"],
  ["vitrine", "Te choisir"],
  ["chart", "Te faire vivre"],
  ["cal", "Le planning"],
  ["globe", "Ton site"],
];

export function VenteBeStable({ partie, etat }: { partie: Partie; etat: EtatBrique }) {
  const t = TEXTES[partie];
  return (
    <div className="vb rise">
      <section className={`vb-hero vb-${partie}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={withBase(SCENE[partie])} alt="" className="vb-scene" />
        <div className="vb-hero-tx">
          <span className="vb-eyeb">{t.eyeb}</span>
          <h1>{t.titre}</h1>
          <p>{t.sous}</p>
        </div>
      </section>

      <div className="vb-prix">
        <div>
          <b>{PRIX_MOIS}</b>
          <span>par mois, tout compris</span>
        </div>
        <em>7 jours d’essai</em>
      </div>
      <Appel etat={etat} />

      <section className="vb-sec">
        <h2>Ce que tu verras ici</h2>
        <div className="vb-ecran" aria-label="Aperçu de l’écran, sur une écurie d’exemple">
          <span className="vb-ex">Exemple</span>
          <Apercu partie={partie} />
        </div>
      </section>

      <section className="vb-sec">
        <h2>Ce que ça change pour toi</h2>
        <ul className="vb-gains">
          {t.gains.map(([ic, x]) => (
            <li key={x}>
              <span className="vb-gic">
                <Ic n={ic} className="" />
              </span>
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="vb-tout">
        <h2>Un seul abonnement, tout Be Stable</h2>
        <div className="vb-chips">
          {TOUT.map(([ic, x]) => (
            <span key={x} className={x === t.eyeb ? "on" : undefined}>
              <Ic n={ic} className="" />
              {x}
            </span>
          ))}
        </div>
        <p>Ta fiche bestable.fr et tes demandes restent gratuites, sans limite.</p>
        <Appel etat={etat} clair />
      </section>
      <div className="end" />
    </div>
  );
}

/** Le bouton : « Me prévenir » avant l'ouverture, l'essai ensuite, ou la fin de l'essai. */
function Appel({ etat, clair = false }: { etat: EtatBrique; clair?: boolean }) {
  const { essaiPossible, commencerEssai, alertes, basculerAlerte } = useBriques();
  const cls = `btn full${clair ? " vb-btn-clair" : ""}`;
  if (etat === "bientot") {
    // Une seule offre : l'alerte « argent » du site sert à prévenir de l'ouverture de l'abonnement.
    const on = !!alertes.argent;
    return (
      <div className="vb-appel">
        <button type="button" className={cls} aria-pressed={on} onClick={() => basculerAlerte("argent")}>
          <Ic n={on ? "ck" : "bell"} className="" />
          {on ? "Tu seras prévenu à l’ouverture" : "Me prévenir à l’ouverture"}
        </button>
        <small>{on ? "Un seul e-mail, à l’adresse de ton compte. Touche encore pour annuler." : "Bientôt dans Be Stable. Un seul e-mail, à l’adresse de ton compte."}</small>
      </div>
    );
  }
  if (essaiPossible)
    return (
      <div className="vb-appel">
        <button type="button" className={cls} onClick={commencerEssai}>
          Essayer 7 jours, sans carte bancaire
        </button>
        <small>L’essai démarre maintenant et ouvre tout Be Stable. Ensuite {PRIX_MOIS} par mois.</small>
      </div>
    );
  // Le paiement de l'abonnement n'existe pas encore (lien Stripe à créer) : on le dit, sans faux bouton.
  return (
    <div className="vb-appel">
      <p className="vb-fin">
        <b>Ton essai est terminé.</b> Tout ce que tu as rempli est gardé, et revient dès l’abonnement, {PRIX_MOIS} par mois.
      </p>
    </div>
  );
}

/** L'écran tel qu'il sera une fois ouvert, sur une écurie d'exemple. */
function Apercu({ partie }: { partie: Partie }) {
  if (partie === "trouver")
    return (
      <div className="vb-ap">
        <div className="vb-score">
          <span>
            <small>Ta fiche bestable.fr</small>
            <b>8 sur 11</b>
          </span>
          <span className="vb-bar">
            <i style={{ width: "73%" }} />
          </span>
        </div>
        <div className="vb-now">
          <small>À faire d’abord · 5 minutes</small>
          <b>Ajouter 3 photos des prés</b>
          <span>Le cavalier regarde d’abord où vivra son cheval.</span>
        </div>
        <ul className="vb-pts">
          <li className="ko">
            <i />
            Aucun site ni page indiqués<em>À corriger</em>
          </li>
          <li className="mid">
            <i />
            Places à confirmer<em>À revoir</em>
          </li>
          <li className="ok">
            <i />
            Prix affiché<em>C’est bon</em>
          </li>
        </ul>
      </div>
    );
  if (partie === "choisir")
    return (
      <div className="vb-ap">
        <p className="vb-ap-lead">Dans ton département, la moitié des pensions coûtent entre 208 € et 378 € par mois.</p>
        {(
          [
            ["Retraite au pré", "320 €", 52, "Dans la moyenne", "dans"],
            ["Box + paddock", "490 €", 84, "Au-dessus de la plupart", "dessus"],
            ["Pension travail", "590 €", 96, "Au-dessus, avec le travail du cheval", "dessus"],
          ] as const
        ).map(([nom, prix, pct, mot, cls]) => (
          <div key={nom} className="vb-of">
            <span className="vb-of-h">
              <b>{nom}</b>
              <b>{prix}</b>
            </span>
            <span className="vb-rng">
              <span className="z" />
              <span className="d" style={{ left: `${pct}%` }} />
            </span>
            <small className={cls}>{mot}</small>
          </div>
        ))}
        <div className="vb-fun">
          <span>
            <b>9</b>demandes
          </span>
          <span>
            <b>4</b>visites
          </span>
          <span>
            <b>2</b>chevaux arrivés
          </span>
        </div>
      </div>
    );
  return (
    <div className="vb-ap">
      <div className="vb-reste">
        <small>Ce mois-ci, il te reste</small>
        <b>942 €</b>
        <span className="vb-bar d">
          <i style={{ width: "94%" }} />
        </span>
        <span>94 % de ton objectif de 1 000 €</span>
      </div>
      <ul className="vb-cli">
        <li>
          <b>Léa B.</b>
          <span>Sirius · pension et 4 cours</span>
          <em className="in">+212 €</em>
        </li>
        <li>
          <b>Paul D.</b>
          <span>Mistral · pension travail</span>
          <em className="in">+148 €</em>
        </li>
        <li>
          <b>Julie P.</b>
          <span>Pacha · ferrure non refacturée</span>
          <em className="out">−85 €</em>
        </li>
      </ul>
    </div>
  );
}
