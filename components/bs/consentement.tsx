"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AVEC_GA, AVEC_PIXEL, MESURE_POSEE, OUVRIR_CHOIX, appliquerChoix, enregistrerChoix, lireChoix, mesurerUneFois, type Choix } from "@/lib/mesure";

/**
 * Le bandeau des témoins (cookies) et la mesure d'audience. Rien du tout
 * tant qu'aucun identifiant n'est posé (lib/mesure). Sinon : le bandeau tant
 * qu'il n'y a pas de choix valable (6 mois), trois boutons au même niveau
 * (Refuser, Paramétrer, Accepter), rien de chargé avant l'accord, et
 * Réglages rouvre les choix.
 */
export function Consentement() {
  const [choix, setChoix] = useState<Choix | null | undefined>(undefined);
  const [panneau, setPanneau] = useState(false);

  useEffect(() => {
    if (!MESURE_POSEE) return;
    const c = lireChoix();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoix(c);
    appliquerChoix(c);
    const ouvrir = () => setPanneau(true);
    window.addEventListener(OUVRIR_CHOIX, ouvrir);
    return () => window.removeEventListener(OUVRIR_CHOIX, ouvrir);
  }, []);

  // Les étapes qui se lisent dans les données : les trois questions finies, la première saisie, une facture faite.
  useEffect(() => {
    if (!MESURE_POSEE || !choix || (!choix.audience && !choix.pub)) return;
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
    });
    return () => {
      annule = true;
      fin();
    };
  }, [choix]);

  if (!MESURE_POSEE || choix === undefined) return null;
  const choisir = (audience: boolean, pub: boolean) => {
    setChoix(enregistrerChoix(audience, pub));
    setPanneau(false);
  };
  if (panneau) return <Panneau choix={choix} onChoisir={choisir} onClose={() => setPanneau(false)} />;
  if (choix) return null;
  return createPortal(
    <div className="bs-cs" role="region" aria-label="Témoins et mesure d’audience">
      <p>
        On aimerait mesurer comment l’app est utilisée{AVEC_PIXEL ? " et l’effet de nos publicités" : ""}, avec des témoins (cookies) de {[AVEC_GA && "Google", AVEC_PIXEL && "Meta"].filter(Boolean).join(" et ")}. Seulement si tu es d’accord : aucun chiffre de ton écurie ne part.{" "}
        <Link href="/regles?t=confidentialite">En savoir plus</Link>
      </p>
      <div className="bs-cs-b">
        <button type="button" onClick={() => choisir(false, false)}>
          Refuser
        </button>
        <button type="button" onClick={() => setPanneau(true)}>
          Paramétrer
        </button>
        <button type="button" onClick={() => choisir(AVEC_GA, AVEC_PIXEL)}>
          Accepter
        </button>
      </div>
    </div>,
    document.body,
  );
}

function Panneau({ choix, onChoisir, onClose }: { choix: Choix | null; onChoisir: (audience: boolean, pub: boolean) => void; onClose: () => void }) {
  const [audience, setAudience] = useState(choix?.audience ?? false);
  const [pub, setPub] = useState(choix?.pub ?? false);
  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [onClose]);
  return createPortal(
    <div className="bs-cs-wrap">
      <div className="bs-cs-scrim" onClick={onClose} />
      <div className="bs-cs-p" role="dialog" aria-modal="true" aria-labelledby="bs-cs-t">
        <b id="bs-cs-t">Tes choix de témoins</b>
        <p className="bs-cs-n">Rien n’est chargé sans ton accord. Ton choix est gardé 6 mois sur cet appareil ; tu le changes quand tu veux dans Réglages.</p>
        {AVEC_GA && (
          <label className="bs-cs-l">
            <input type="checkbox" checked={audience} onChange={(e) => setAudience(e.target.checked)} />
            <span>
              <b>Mesure d’audience</b>
              <small>Google Analytics : combien de personnes passent chaque étape (l’histoire, les trois questions, le compte créé, la première facture). Pas tes chiffres.</small>
            </span>
          </label>
        )}
        {AVEC_PIXEL && (
          <label className="bs-cs-l">
            <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} />
            <span>
              <b>Publicité</b>
              <small>Pixel Meta : savoir si nos publicités sur Facebook et Instagram amènent des gérants.</small>
            </span>
          </label>
        )}
        <div className="bs-cs-b">
          <button type="button" onClick={() => onChoisir(false, false)}>
            Tout refuser
          </button>
          <button type="button" onClick={() => onChoisir(audience && AVEC_GA, pub && AVEC_PIXEL)}>
            Enregistrer mes choix
          </button>
          <button type="button" onClick={() => onChoisir(AVEC_GA, AVEC_PIXEL)}>
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
    if (!MESURE_POSEE) return;
    const c = lireChoix();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResume(!c ? "Pas encore choisi" : c.audience || c.pub ? "Accepté" + (c.audience !== c.pub && AVEC_GA && AVEC_PIXEL ? " en partie" : "") : "Refusé");
  }, []);
  if (!MESURE_POSEE) return null;
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OUVRIR_CHOIX))}>
      {children(resume)}
    </button>
  );
}
