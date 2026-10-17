"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Hello, Ic, Page } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";

/** Le fichier de ce qui reste : les données lisibles, plus la copie d'origine telle qu'elle était enregistrée. */
export function exporterCeQuiReste(origine?: string) {
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
  const out = { app: "be-stable", version: 2, exportedAt: new Date().toISOString(), "be-stable-data": { state: data }, "be-stable-settings": { state: settings }, ...(origine ? { "copie-d-origine": origine } : {}) };
  const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `be-stable-ce-qui-reste-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** L'écran de secours : ce qui était abîmé, et deux gestes clairs. */
export function SecoursEcran({ problemes, origine, onRepartir, onGarder, garder = "Continuer avec ce qui reste" }: { problemes: string[]; origine?: string; onRepartir: () => void; onGarder?: () => void; garder?: string }) {
  const [exporte, setExporte] = useState(false);
  return (
    <Page>
      <Hello
        title="Une partie de tes données ne se lit plus."
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
          Exporter ce qui reste
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
          onClick={() => {
            if (window.confirm(exporte ? "Repartir sur cet appareil ? Ce qui reste sera remplacé." : "Repartir sans garder de copie ? Ce qui reste sera remplacé. Exporte-le d’abord si tu en as besoin.")) onRepartir();
          }}
        >
          Repartir
        </button>
      </div>
      <div className="end" />
    </Page>
  );
}

/**
 * Au chargement, des données abîmées ont été lues (stores/data-store,
 * `secours`) : l'écran de secours passe devant, au lieu d'écrans qui tombent.
 */
export function Secours({ children }: { children: ReactNode }) {
  const secours = useDataStore((s) => s.secours);
  const quitter = useDataStore((s) => s.quitterSecours);
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted || !secours) return <>{children}</>;
  return <SecoursEcran problemes={secours.problemes} origine={secours.copie} onGarder={() => quitter("garder")} onRepartir={() => quitter("repartir")} />;
}
