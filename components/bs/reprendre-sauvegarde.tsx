"use client";

import { useEffect } from "react";
import { enter, getSession, hasLocaleData, setSession, type LocaleSession } from "@/lib/account/session";
import { fusionFactures } from "@/lib/domain/facture";
import { compteurAppareil } from "@/lib/account/factures-seq";
import { lireSauvegarde } from "@/lib/domain/valider";
import { migrerDonnees, useDataStore, VERSION_DONNEES } from "@/stores/data-store";
import { migrerReglages, useSettingsStore, VERSION_REGLAGES } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { useConfirmer, type Question } from "@/components/bs/confirmer";

/**
 * Reprendre une sauvegarde (le fichier de « Faire une sauvegarde »). Dans
 * l'app, elle remplace ce qui est ouvert. À l'arrivée, sans compte, elle
 * ouvre l'écurie en essai sur cet appareil (session « locale »), puis
 * l'accueil propose de créer le compte pour la garder. Les mêmes contrôles
 * partout : un fichier abîmé, d'un autre format ou d'une version plus
 * récente de l'app est refusé avec la raison, et rien n'est remplacé.
 */
const MARQUE = "bs-sauvegarde-ouverte";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function reprendreSauvegarde(texte: string, demander: (q: Question) => Promise<boolean>, depuisArrivee = false): Promise<void> {
  const lu = lireSauvegarde(texte, { donnees: VERSION_DONNEES, reglages: VERSION_REGLAGES });
  if (!lu.ok) {
    await demander({ titre: "Cette sauvegarde ne s’ouvre pas", texte: lu.raison, oui: "D’accord", non: null });
    return;
  }
  const question: Question = !depuisArrivee
    ? { titre: "Ouvrir cette sauvegarde ?", texte: "Elle remplace ce qui est dans l’app. Tes factures faites depuis restent.", oui: "Oui, l’ouvrir" }
    : hasLocaleData()
      ? { titre: "Ouvrir cette sauvegarde ?", texte: "Elle remplace l’essai rangé sur cet appareil. Tes factures faites depuis restent.", oui: "Oui, l’ouvrir" }
      : { titre: "Ouvrir cette sauvegarde ?", texte: "Ton écurie s’ouvre sur cet appareil, sans compte. Tu pourras ensuite créer ton compte pour la garder.", oui: "Oui, l’ouvrir" };
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
            if (f) await reprendreSauvegarde(await f.text(), demander, true);
          }}
        />
      </label>
      {feuille}
    </>
  );
}

/** À l'accueil, juste après : la sauvegarde est ouverte sur cet appareil, le compte la gardera. */
export function useSauvegardeOuverte() {
  const say = useUiStore((s) => s.say);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(MARQUE) !== "1") return;
      sessionStorage.removeItem(MARQUE);
    } catch {
      return;
    }
    say("Ta sauvegarde est ouverte, sur cet appareil seulement. Crée ton compte pour la garder.");
  }, [say]);
}
