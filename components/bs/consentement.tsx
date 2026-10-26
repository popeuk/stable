"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AVEC_GA, AVEC_MATOMO, AVEC_PIXEL, MESURE_POSEE, MESURE_REGLABLE, OUVRIR_CHOIX, appliquerChoix, choisirMatomo, enregistrerChoix, lireChoix, matomoActif, matomoPage, mesurerUneFois, type Choix } from "@/lib/mesure";
import { FACTURATION } from "@/lib/fonctions";

/**
 * Le bandeau des cookies et la mesure d'audience. Rien du tout tant qu'aucun
 * identifiant n'est posé (lib/mesure). Sinon : le bandeau tant qu'il n'y a
 * pas de choix valable (6 mois), trois boutons au même niveau (Refuser,
 * Choisir, Accepter), rien de chargé avant l'accord, et Réglages rouvre les
 * choix. Les mots sont ceux d'un gérant : « cookies », « statistiques de
 * visite », « publicités » ; Google et Meta restent nommés.
 *
 * Matomo (sans cookie) n'a pas de bandeau : il compte chaque écran dès
 * l'ouverture, sauf si on l'a refusé dans le panneau (case « Statistiques
 * anonymes »). « Refuser » dans le bandeau ne parle que des cookies.
 */
export function Consentement() {
  const [choix, setChoix] = useState<Choix | null | undefined>(undefined);
  const [panneau, setPanneau] = useState(false);
  const [matomo, setMatomo] = useState(false);
  const chemin = usePathname();

  // Une page vue Matomo à chaque écran (l'adresse est relue dans lib/mesure, sans sa recherche).
  useEffect(() => {
    if (matomo) matomoPage();
  }, [chemin, matomo]);

  useEffect(() => {
    if (!MESURE_REGLABLE) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatomo(matomoActif());
    const c = lireChoix();
    setChoix(c);
    appliquerChoix(c);
    const ouvrir = () => setPanneau(true);
    window.addEventListener(OUVRIR_CHOIX, ouvrir);
    return () => window.removeEventListener(OUVRIR_CHOIX, ouvrir);
  }, []);

  // Les étapes qui se lisent dans les données : les trois questions finies, la première saisie, une facture faite.
  useEffect(() => {
    if (!matomo && (!MESURE_POSEE || !choix || (!choix.audience && !choix.pub))) return;
    let fin = () => {};
    let annule = false;
    void Promise.all([import("@/stores/data-store"), import("@/stores/settings-store"), import("@/lib/premiere-saisie")]).then(([{ useDataStore }, { useSettingsStore }, { aDejaSaisi, nouvelleSaisie }]) => {
      if (annule) return;
      const d = useDataStore.subscribe((apres, avant) => {
        if (!avant.hydrated || !apres.hydrated) return;
        if (!aDejaSaisi(avant) && nouvelleSaisie(avant, apres)) mesurerUneFois("premiere_saisie");
        const ids = new Set((avant.invoices ?? []).map((i) => i.id));
        if ((apres.invoices ?? []).some((i) => !ids.has(i.id)) && (avant.invoices ?? []).every((i) => (apres.invoices ?? []).some((j) => j.id === i.id))) mesurerUneFois("facture_faite");
      });
      const s = useSettingsStore.subscribe((apres, avant) => {
        const tout = (p: typeof apres.parcours) => !!(p.chevaux && p.tarifs && p.factures);
        if (!tout(avant.parcours) && tout(apres.parcours)) mesurerUneFois("questions_finies");
      });
      fin = () => (d(), s());
    }).catch(() => {});
    return () => {
      annule = true;
      fin();
    };
  }, [choix, matomo]);

  if (!MESURE_REGLABLE || choix === undefined) return null;
  const choisir = (audience: boolean, pub: boolean, anonymes = matomo) => {
    if (AVEC_MATOMO) {
      choisirMatomo(anonymes);
      setMatomo(anonymes);
    }
    // Sans outil à cookies, il n'y a que Matomo à régler : pas de choix de cookies à garder.
    if (MESURE_POSEE) setChoix(enregistrerChoix(audience, pub));
    setPanneau(false);
  };
  if (panneau) return <Panneau choix={choix} matomo={matomo} onChoisir={choisir} onClose={() => setPanneau(false)} />;
  if (choix || !MESURE_POSEE) return null;
  return createPortal(
    <div className="bs-cs" role="region" aria-label="Cookies">
      <p>
        {phraseCookies(AVEC_GA, AVEC_PIXEL)}{" "}
        <Link href="/regles?t=confidentialite">En savoir plus</Link>
      </p>
      <div className="bs-cs-b">
        <button type="button" onClick={() => choisir(false, false)}>
          Refuser
        </button>
        <button type="button" onClick={() => setPanneau(true)}>
          Choisir
        </button>
        <button type="button" onClick={() => choisir(AVEC_GA, AVEC_PIXEL)}>
          Accepter
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** La phrase du bandeau : à quoi servent les cookies, avec qui, et que rien ne part sans accord. */
export function phraseCookies(ga: boolean, pixel: boolean): string {
  const quoi = [ga && "comment l’app est utilisée (avec Google)", pixel && "si nos publicités marchent (avec Meta)"].filter(Boolean).join(" et ");
  return `On aimerait savoir ${quoi}. Il faut pour ça des cookies, seulement si tu es d’accord. Les chiffres de ton écurie ne partent jamais.`;
}

function Panneau({ choix, matomo, onChoisir, onClose }: { choix: Choix | null; matomo: boolean; onChoisir: (audience: boolean, pub: boolean, anonymes: boolean) => void; onClose: () => void }) {
  const [audience, setAudience] = useState(choix?.audience ?? false);
  const [pub, setPub] = useState(choix?.pub ?? false);
  const [anonymes, setAnonymes] = useState(matomo);
  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [onClose]);
  return createPortal(
    <div className="bs-cs-wrap">
      <div className="bs-cs-scrim" onClick={onClose} />
      <div className="bs-cs-p" role="dialog" aria-modal="true" aria-labelledby="bs-cs-t">
        <b id="bs-cs-t">{MESURE_POSEE ? "Tes choix de cookies" : "Statistiques"}</b>
        {MESURE_POSEE && <p className="bs-cs-n">Rien n’est chargé sans ton accord. Ton choix est gardé 6 mois ici ; tu le changes quand tu veux dans Réglages.</p>}
        {AVEC_MATOMO && (
          <label className="bs-cs-l">
            <input type="checkbox" checked={anonymes} onChange={(e) => setAnonymes(e.target.checked)} />
            <span>
              <b>Statistiques anonymes</b>
              <small>Sans cookie, sur nos serveurs (Matomo) : quels écrans servent, sans savoir qui tu es. Pas tes chiffres. Décoche pour ne pas être compté.</small>
            </span>
          </label>
        )}
        {AVEC_GA && (
          <label className="bs-cs-l">
            <input type="checkbox" checked={audience} onChange={(e) => setAudience(e.target.checked)} />
            <span>
              <b>Statistiques de visite</b>
              <small>Avec Google Analytics : combien de personnes passent chaque étape (l’histoire, les trois questions, le compte créé{FACTURATION ? ", la première facture" : ""}). Pas tes chiffres.</small>
            </span>
          </label>
        )}
        {AVEC_PIXEL && (
          <label className="bs-cs-l">
            <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} />
            <span>
              <b>Publicités (Meta)</b>
              <small>Savoir si nos publicités sur Facebook et Instagram amènent des gérants.</small>
            </span>
          </label>
        )}
        <div className="bs-cs-b">
          <button type="button" onClick={() => onChoisir(false, false, false)}>
            Tout refuser
          </button>
          <button type="button" onClick={() => onChoisir(audience && AVEC_GA, pub && AVEC_PIXEL, anonymes)}>
            Enregistrer mes choix
          </button>
          <button type="button" onClick={() => onChoisir(AVEC_GA, AVEC_PIXEL, true)}>
            Tout accepter
          </button>
        </div>
        <Link href="/regles?t=confidentialite" className="bs-cs-lien" onClick={onClose}>
          Ce que dit la politique de confidentialité
        </Link>
      </div>
    </div>,
    document.body,
  );
}

/** La ligne de Réglages pour changer d'avis ; rien si la mesure n'est pas posée. */
export function ChoixTemoinsLigne({ className, children }: { className: string; children: (resume: string) => React.ReactNode }) {
  const [resume, setResume] = useState("");
  useEffect(() => {
    if (!MESURE_REGLABLE) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResume(resumeChoix(MESURE_POSEE ? lireChoix() : null, matomoActif()));
  }, []);
  if (!MESURE_REGLABLE) return null;
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OUVRIR_CHOIX))}>
      {children(resume)}
    </button>
  );
}

/** Le résumé de la ligne de Réglages : les cookies (s'il y en a de posés), puis les statistiques anonymes. */
export function resumeChoix(c: Choix | null, anonymes: boolean, ga = AVEC_GA, pixel = AVEC_PIXEL, matomo = AVEC_MATOMO): string {
  const cookies = !(ga || pixel) ? "" : !c ? "Cookies pas encore choisis" : c.audience || c.pub ? "Cookies acceptés" + (c.audience !== c.pub && ga && pixel ? " en partie" : "") : "Cookies refusés";
  const stats = matomo ? (anonymes ? "statistiques anonymes" : "sans statistiques") : "";
  const tout = [cookies, stats].filter(Boolean).join(", ");
  return tout.charAt(0).toUpperCase() + tout.slice(1);
}
