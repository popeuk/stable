"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useBriques } from "@/components/bs/briques";
import { ARGENT, PLANNING } from "@/components/bs/navigation";
import { under } from "@/components/bs/nav";
import { Ic, Ill, type IllName } from "@/components/carnet/ui";
import { estOuverte, type AlerteId, type EtatBrique } from "@/lib/briques";
import "@/app/carnet/briques.css";

/**
 * La porte des briques (27 octobre 2026) : sur les écrans de Mon argent et du
 * planning, tant que la brique n'est pas ouverte, on montre ce qu'on y trouve
 * (un aperçu marqué « Exemple ») et le moyen de l'ouvrir. Pas de mur, pas de
 * message d'erreur : le gérant sait ce qu'il pourrait avoir.
 */
export function PorteBrique({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "";
  const { etat, pret } = useBriques();
  // Tant que le compte n'est pas lu, on n'affiche rien plutôt qu'un écran qui passerait ensuite sous cadenas.
  if (!pret && (under(path, ARGENT) || under(path, PLANNING))) return null;
  if (under(path, ARGENT) && !estOuverte(etat.argent)) return <Verrou brique="argent" etat={etat.argent} />;
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
  const { essaiPossible, commencerEssai } = useBriques();
  return (
    <div className="cn-page bq-verrou rise">
      <header className="ce-hd">
        <h1>{t.titre}</h1>
        <p>{t.sous}</p>
      </header>
      <Apercu brique={brique} />
      {etat === "bientot" ? (
        <Alerte id={brique} sombre />
      ) : brique === "argent" && essaiPossible ? (
        <section className="bq-al d">
          <Ill n={t.ill} className="bq-al-ill" />
          <h2>30 jours pour essayer Mon argent</h2>
          <p>Ton bilan, tes clients, tes chevaux. L’essai démarre quand tu touches le bouton, sans carte bancaire. Ensuite 6,99 € par mois : tu choisis au 25e jour.</p>
          <button type="button" className="btn full" onClick={commencerEssai}>
            Commencer mes 30 jours
          </button>
        </section>
      ) : brique === "argent" ? (
        <section className="bq-al d">
          <Ill n={t.ill} className="bq-al-ill" />
          <h2>Ton essai est terminé</h2>
          <p>Tes chiffres sont gardés, simplement masqués. Mon argent reprend dès l’abonnement, 6,99 € par mois, sur bestable.fr.</p>
        </section>
      ) : (
        <section className="bq-al d">
          <Ill n={t.ill} className="bq-al-ill" />
          <h2>Compris dans le site et Google, à 49 €</h2>
          <p>Ton site tenu à jour, ta fiche Google gérée, et le planning pour tes cours et ton équipe.</p>
          <Link href="/mon-site" className="btn full">
            Voir les offres du site
          </Link>
        </section>
      )}
    </div>
  );
}

const NOMS: Record<AlerteId, { titre: string; texte: string }> = {
  argent: { titre: "Mon argent", texte: "Ce que te rapporte chaque cheval et chaque client, ton bilan du mois. 30 jours d’essai à l’ouverture, puis 6,99 € par mois." },
  planning: { titre: "Le planning", texte: "Tes cours, tes stages et ton équipe. Il sera compris dans l’offre « le site et Google », à 49 € par mois." },
  site: { titre: "Ton site", texte: "Ton site à ton nom, fait à partir de ta fiche. À partir de 19 € par mois." },
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
