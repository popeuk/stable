"use client";

import { useState } from "react";
import { Hello, Ic, Page } from "@/components/carnet/ui";
import { useDataStore, VERSION_DONNEES } from "@/stores/data-store";
import { useSettingsStore, VERSION_REGLAGES } from "@/stores/settings-store";
import { useConfirmer } from "@/components/bs/confirmer";
import { contenuSauvegarde, telechargerSauvegarde } from "@/lib/sauvegarde";

/** Une sauvegarde ordinaire de ce qui est à l'écran (le bandeau de la copie en ligne refusée). */
export function exporterSauvegarde() {
  const plain = (o: object) => JSON.parse(JSON.stringify(o, (_k, v) => (typeof v === "function" ? undefined : v)));
  const out = contenuSauvegarde({ data: plain(useDataStore.getState()), settings: plain(useSettingsStore.getState()), versionDonnees: VERSION_DONNEES, versionReglages: VERSION_REGLAGES });
  telechargerSauvegarde(out, `be-stable-${new Date().toISOString().slice(0, 10)}.json`);
}

/** Le fichier de ce qui reste : les données lisibles, plus la copie d'origine telle qu'elle était enregistrée. */
export function exporterCeQuiReste(origine?: string, nom = "be-stable-ce-qui-reste") {
  const plain = (o: object) => JSON.parse(JSON.stringify(o, (_k, v) => (typeof v === "function" ? undefined : v)));
  let data: Record<string, unknown> = {};
  let settings: Record<string, unknown> = {};
  try {
    data = plain(useDataStore.getState());
    delete data.secours;
  } catch {
    /* rien de lisible */
  }
  try {
    settings = plain(useSettingsStore.getState());
  } catch {
    /* rien de lisible */
  }
  const out = contenuSauvegarde({ data, settings, versionDonnees: VERSION_DONNEES, versionReglages: VERSION_REGLAGES, plus: origine ? { "copie-d-origine": origine } : {} });
  telechargerSauvegarde(out, `${nom}-${new Date().toISOString().slice(0, 10)}.json`);
}

/** L'écran de secours : ce qui était abîmé, et deux gestes clairs. */
export function SecoursEcran({ problemes, origine, onRepartir, onGarder, garder = "Continuer avec ce qui reste" }: { problemes: string[]; origine?: string; onRepartir: () => void; onGarder?: () => void; garder?: string }) {
  const [exporte, setExporte] = useState(false);
  const [demander, feuille] = useConfirmer();
  return (
    <Page>
      <Hello
        title="Une partie de ce que tu as noté est abîmée."
        sub={problemes.length ? `Ce qui est abîmé : ${problemes.join(", ")}. Le reste est là. Garde-en une copie avant de choisir.` : "Garde une copie de ce qui reste avant de choisir."}
      />
      <div className="pad rise" style={{ display: "grid", gap: 10, marginTop: 16, animationDelay: ".1s" }}>
        <button
          type="button"
          className="btn full"
          onClick={() => {
            exporterCeQuiReste(origine);
            setExporte(true);
          }}
        >
          <Ic n="download" className="" />
          Garder une copie de ce qui reste
        </button>
        {exporte && <p className="note">Le fichier est dans tes téléchargements. Tu pourras le donner à Be Stable pour qu’on t’aide à le relire.</p>}
        {onGarder && (
          <button type="button" className="btn line full" onClick={onGarder}>
            {garder}
          </button>
        )}
        <button
          type="button"
          className="btn line full"
          onClick={async () => {
            if (await demander(exporte ? { titre: "Repartir de zéro ?", texte: "Ce qui reste sera effacé.", oui: "Oui, repartir de zéro", danger: true } : { titre: "Repartir sans copie ?", texte: "Ce qui reste sera effacé. Garde-en une copie d’abord si tu en as besoin.", oui: "Oui, repartir sans copie", danger: true })) onRepartir();
          }}
        >
          Repartir de zéro
        </button>
      </div>
      <div className="end" />
      {feuille}
    </Page>
  );
}

/**
 * Au chargement, des données abîmées ont été lues (stores/data-store,
 * `secours`) : l'écran de secours passe devant, au lieu d'écrans qui tombent.
 */
