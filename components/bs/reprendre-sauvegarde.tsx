"use client";

import { enter, getSession, hasLocaleData, setSession, type LocaleSession } from "@/lib/account/session";
import { changementsVendeur, fusionFactures } from "@/lib/domain/facture";
import { cetAppareil } from "@/lib/appareil";
import { compteurAppareil } from "@/lib/account/factures-seq";
import { lireSauvegarde } from "@/lib/domain/valider";
import { migrerDonnees, useDataStore, VERSION_DONNEES } from "@/stores/data-store";
import { migrerReglages, useSettingsStore, VERSION_REGLAGES } from "@/stores/settings-store";
import { useConfirmer, type Question } from "@/components/bs/confirmer";
import { MARQUE } from "@/components/bs/sauvegarde-ouverte";

/**
 * Reprendre une sauvegarde (le fichier de « Faire une sauvegarde »). Dans
 * l'app, elle remplace ce qui est ouvert. À l'arrivée, sans compte, elle
 * ouvre l'écurie en essai sur cet appareil (session « locale »), puis
 * l'accueil propose de créer le compte pour la garder. Les mêmes contrôles
 * partout : un fichier abîmé, d'un autre format ou d'une version plus
 * récente de l'app est refusé avec la raison, et rien n'est remplacé.
 */
/** Au-delà, ce n'est pas une sauvegarde de l'app (une très grosse écurie en fait 2 ou 3 Mo) : on ne le lit pas. */
export const TAILLE_MAX_SAUVEGARDE = 10 * 1024 * 1024;

/** Ouvre le fichier choisi : refusé sans être lu s'il dépasse 10 Mo. */
export async function ouvrirFichierSauvegarde(f: File, demander: (q: Question) => Promise<boolean>, depuisArrivee = false): Promise<void> {
  if (f.size > TAILLE_MAX_SAUVEGARDE) {
    await demander({ titre: "Cette sauvegarde ne s’ouvre pas", texte: "Ce fichier fait plus de 10 Mo : ce n’est pas une sauvegarde de Be Stable. Choisis le fichier « be-stable-… .json » de Faire une sauvegarde.", oui: "D’accord", non: null });
    return;
  }
  await reprendreSauvegarde(await f.text(), demander, depuisArrivee);
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function reprendreSauvegarde(texte: string, demander: (q: Question) => Promise<boolean>, depuisArrivee = false): Promise<void> {
  const lu = lireSauvegarde(texte, { donnees: VERSION_DONNEES, reglages: VERSION_REGLAGES });
  if (!lu.ok) {
    await demander({ titre: "Cette sauvegarde ne s’ouvre pas", texte: lu.raison, oui: "D’accord", non: null });
    return;
  }
  const question: Question = !depuisArrivee
    ? { titre: "Ouvrir cette sauvegarde ?", texte: "Elle remplace ce qui est dans l’app. Les factures faites après cette sauvegarde restent.", oui: "Oui, l’ouvrir" }
    : hasLocaleData()
      ? { titre: "Ouvrir cette sauvegarde ?", texte: `Elle remplace l’essai rangé sur ${cetAppareil()}. Les factures faites après cette sauvegarde restent.`, oui: "Oui, l’ouvrir" }
      : { titre: "Ouvrir cette sauvegarde ?", texte: `Ton écurie s’ouvre sur ${cetAppareil()}, sans compte. Tu pourras ensuite créer ton compte pour la garder.`, oui: "Oui, l’ouvrir" };
  // Ce qui s'imprime sur tes factures (IBAN, SIRET, nom) : dit avant d'ouvrir.
  const change = changementsVendeur(useDataStore.getState().billing, lu.data.billing);
  if (change.length) Object.assign(question, { texte: `${change.join(" ")} ${question.texte}`, danger: true });
  if (!(await demander(question))) return;
  let session: LocaleSession | null = null;
  if (depuisArrivee && getSession()?.kind !== "compte") {
    session = { kind: "locale", at: new Date().toISOString() };
    setSession(session);
    await Promise.all([useDataStore.persist.rehydrate(), useSettingsStore.persist.rehydrate()]);
  }
  // Une sauvegarde d'une version d'avant passe par la même mise à jour qu'au chargement, depuis sa version.
  const repris = migrerDonnees(lu.data, lu.versionDonnees);
  // Les factures faites depuis la sauvegarde restent, et le compteur ne recule jamais.
  const avant = useDataStore.getState();
  useDataStore.setState({ ...(repris as Partial<ReturnType<typeof useDataStore.getState>>), ...fusionFactures(repris, avant, compteurAppareil()), secours: undefined, hydrated: true });
  if (lu.settings) useSettingsStore.setState(lu.versionReglages !== null && lu.versionReglages < VERSION_REGLAGES ? migrerReglages(lu.settings, lu.versionReglages) : lu.settings);
  // Le coffre écrit l'un après l'autre : on laisse finir avant de recharger.
  await wait(400);
  if (session) {
    try {
      sessionStorage.setItem(MARQUE, "1");
    } catch {}
    enter(session, "/accueil");
  } else window.location.reload();
}

/** « J'ai une sauvegarde » : le lien de l'arrivée, qui choisit le fichier et l'ouvre en essai. */
export function JaiUneSauvegarde({ className = "lnk" }: { className?: string }) {
  const [demander, feuille] = useConfirmer();
  return (
    <>
      <label className={className} style={{ cursor: "pointer" }}>
        J’ai une sauvegarde
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) await ouvrirFichierSauvegarde(f, demander, true);
          }}
        />
      </label>
      {feuille}
    </>
  );
}
