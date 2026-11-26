"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useBriques } from "@/components/bs/briques";
import { ARGENT, PLANNING } from "@/components/bs/navigation";
import { under } from "@/components/bs/nav";
import { Ic, Ill, type IllName } from "@/components/carnet/ui";
import { PRIX_MOIS, estOuverte, type AlerteId, type EtatBrique } from "@/lib/briques";
import { APPRENDRE_VISIBLE, ARGENT_VISIBLE, PAYANT_VISIBLE, QUATRE_PARTIES } from "@/lib/fonctions";
import { Redirect } from "@/components/bs/redirect";
import "@/app/carnet/briques.css";
import { VenteBeStable } from "@/components/bs/vente-be-stable";

/**
 * La porte des briques (27 octobre 2026) : sur les écrans de Mon argent et du
 * planning, tant que la brique n'est pas ouverte, on montre ce qu'on y trouve
 * (un aperçu marqué « Exemple ») et le moyen de l'ouvrir. Pas de mur, pas de
 * message d'erreur : le gérant sait ce qu'il pourrait avoir.
 */
export function PorteBrique({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "";
  const { etat, pret } = useBriques();
  // La partie argent masquée (lib/fonctions.ts) : ses écrans ramènent à l'accueil. Avec les quatre parties,
  // Te faire vivre et le planning restent visibles : sous cadenas ou « bientôt » tant que la brique n'est pas ouverte.
  if (!ARGENT_VISIBLE && !QUATRE_PARTIES && (under(path, ARGENT) || under(path, PLANNING))) return <Redirect to="/accueil" />;
  // Le payant masqué (lib/fonctions.ts) : Mon site ramène à la Vitrine.
  if (!PAYANT_VISIBLE && under(path, ["/mon-site"])) return <Redirect to="/ma-fiche" />;
  if (!APPRENDRE_VISIBLE && under(path, ["/apprendre"])) return <Redirect to="/accueil" />;
  // Mon écurie (prix privés, frais, équipe, pros, registre) va avec la partie argent.
  // Les cinq onglets : Mon écurie est un onglet, il reste ouvert.
  if (!ARGENT_VISIBLE && !QUATRE_PARTIES && under(path, ["/ecurie", "/contacts", "/registre"])) return <Redirect to="/reglages" />;
  // Tant que le compte n'est pas lu, on n'affiche rien plutôt qu'un écran qui passerait ensuite sous cadenas.
  if (!pret && (under(path, ARGENT) || under(path, PLANNING))) return null;
  if (under(path, ARGENT) && !estOuverte(etat.argent)) return QUATRE_PARTIES ? <VenteBeStable partie="vivre" etat={etat.argent} /> : <Verrou brique="argent" etat={etat.argent} />;
  // Les quatre parties : Te trouver et Te choisir sont payants (décision de Samuel, 26 novembre 2026).
  if (QUATRE_PARTIES && !pret && under(path, ["/te-trouver", "/te-choisir"])) return null;
  if (QUATRE_PARTIES && under(path, ["/te-trouver"]) && !estOuverte(etat.trouver)) return <VenteBeStable partie="trouver" etat={etat.trouver} />;
  if (QUATRE_PARTIES && under(path, ["/te-choisir"]) && !estOuverte(etat.choisir)) return <VenteBeStable partie="choisir" etat={etat.choisir} />;
  if (under(path, PLANNING) && !estOuverte(etat.planning)) return <Verrou brique="planning" etat={etat.planning} />;
  return <>{children}</>;
}

const TEXTES: Record<"argent" | "planning", { titre: string; sous: string; ill: "sacoche" | "equipe" }> = {
  argent: {
    titre: "Ce que te rapporte chaque client",
    sous: "Chaque mois : ce qu’il paie, ce que coûtent ses chevaux, ce qui te reste. Et ton bilan du mois.",
    ill: "sacoche",
  },
  planning: {
    titre: "Le planning",
    sous: "Tes cours, tes stages, les soins de la journée et ton équipe. Les cours notés comptent tout seuls dans ton bilan.",
    ill: "equipe",
  },
};

/** Un aperçu marqué « Exemple » : des lignes d'une écurie inventée, jamais les chiffres du gérant. */
function Apercu({ brique }: { brique: "argent" | "planning" }) {
  const lignes =
    brique === "argent"
      ? [
          ["Léa B.", "Sirius · pension et 4 cours", "+212 €", "in"],
          ["Paul D.", "Mistral · pension et travail", "+148 €", "in"],
          ["Julie P.", "Pacha · ferrure non refacturée", "−85 €", "out"],
          ["Ton cheval", "Belle", "−210 €", "out"],
        ]
      : [
          ["10 h", "Cours débutants · 4 cavaliers", "", ""],
          ["14 h", "Maréchal pour Pacha", "", ""],
          ["17 h", "Vermifuge de Sirius", "", ""],
        ];
  return (
    <div className="bq-apercu" aria-label="Aperçu d’une écurie d’exemple">
      <p className="bq-ap-hd">
        <span className="bq-ex">Exemple</span>Une écurie d’exemple
      </p>
      <ul>
        {lignes.map(([a, b, c, t]) => (
          <li key={a + b}>
            <b>{a}</b>
            <small>{b}</small>
            {c && <em className={t}>{c}</em>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Verrou({ brique, etat }: { brique: "argent" | "planning"; etat: EtatBrique }) {
  const t = TEXTES[brique];
  return (
    <div className="cn-page bq-verrou rise">
      <header className="ce-hd">
        <h1>{t.titre}</h1>
        <p>{t.sous}</p>
      </header>
      <Apercu brique={brique} />
      {etat === "bientot" ? <Alerte id={brique} sombre /> : <OffreUnique ill={t.ill} />}
    </div>
  );
}

/**
 * L'offre unique (décision de Samuel, 26 novembre 2026) : tout Be Stable pour 29,99 € par mois,
 * avec 7 jours d'essai que le gérant lance lui-même. La fiche et les demandes restent gratuites.
 */
export function OffreUnique({ ill }: { ill?: IllName }) {
  const { essaiPossible, commencerEssai } = useBriques();
  return essaiPossible ? (
    <section className="bq-al d">
      {ill && <Ill n={ill} className="bq-al-ill" />}
      <h2>7 jours pour essayer tout Be Stable</h2>
      <p>Te trouver, te choisir, ton bilan, tes clients, ton planning, ton site. L’essai démarre quand tu touches le bouton, sans carte bancaire. Ensuite {PRIX_MOIS} par mois, tout compris.</p>
      <button type="button" className="btn full" onClick={commencerEssai}>
        Commencer mes 7 jours
      </button>
    </section>
  ) : (
    <section className="bq-al d">
      {ill && <Ill n={ill} className="bq-al-ill" />}
      <h2>Ton essai est terminé</h2>
      <p>Tout ce que tu as rempli est gardé, simplement masqué. Tout reprend dès l’abonnement, {PRIX_MOIS} par mois, tout compris, sur bestable.fr. Ta fiche et tes demandes restent gratuites.</p>
    </section>
  );
}

const NOMS: Record<AlerteId, { titre: string; texte: string }> = {
  argent: { titre: "Mon argent", texte: `Ce que te rapporte chaque cheval et chaque client, ton bilan du mois. Compris dans Be Stable, ${PRIX_MOIS} par mois tout compris, avec 7 jours d’essai à l’ouverture.` },
  planning: { titre: "Le planning", texte: `Tes cours, tes stages et ton équipe. Compris dans Be Stable, ${PRIX_MOIS} par mois tout compris.` },
  site: { titre: "Ton site", texte: `Ton site à ton nom, fait à partir de ta fiche. Compris dans Be Stable, ${PRIX_MOIS} par mois tout compris.` },
  projet: { titre: "Le simulateur d’installation", texte: "Ton prix, tes places, tes frais : ce qu’il te resterait chaque mois, et combien de chevaux il te faut. Nous le préparons." },
};

/** L'alerte « Me prévenir à l'ouverture » : un geste, l'e-mail du compte est déjà connu. */
export function Alerte({ id, sombre = false, ill }: { id: AlerteId; sombre?: boolean; ill?: IllName }) {
  const { alertes, basculerAlerte } = useBriques();
  const n = NOMS[id];
  const on = !!alertes[id];
  return (
    <section className={`bq-al${sombre ? " d" : ""}${on ? " on" : ""}`} aria-live="polite">
      {ill && <Ill n={ill} className="bq-al-ill" />}
      <span className="bq-al-k">
        <Ic n="bell" className="" />
        Bientôt
      </span>
      <h2>{n.titre}</h2>
      <p>{n.texte}</p>
      {on ? (
        <>
          <p className="bq-al-ok">
            <Ic n="ck" className="" />
            <span>
              <b>Tu seras prévenu à l’ouverture.</b>
              <small>Un seul e-mail, à l’adresse de ton compte.</small>
            </span>
          </p>
          <button type="button" className="lnk" onClick={() => basculerAlerte(id)}>
            Ne plus me prévenir
          </button>
        </>
      ) : (
        <>
          <button type="button" className="btn full" onClick={() => basculerAlerte(id)}>
            <Ic n="bell" className="" />
            Me prévenir à l’ouverture
          </button>
          <p className="bq-al-f">Un seul e-mail, à l’adresse de ton compte. Rien d’autre.</p>
        </>
      )}
    </section>
  );
}
