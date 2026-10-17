"use client";

import { useMemo, useState } from "react";
import { Ic } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { KINDS, KIND_LABEL, MENTION_FRANCHISE, TAUX, siretDit, siretPropre, siretValide, tauxDit } from "@/lib/domain/facture";
import { anneesComptables, csvComptable, lignesComptables } from "@/lib/domain/comptable";
import type { VatKind } from "@/lib/domain/types";

/**
 * Les infos de facturation de l'écurie et le tableau du comptable, partagés
 * entre l'écran Factures (/facturation) et la facture elle-même quand il
 * manque quelque chose. Styles : app/carnet/facture.css (fr-).
 */

/** Nom ou raison sociale, adresse, SIRET. */
export function InfosVendeur({ seulement }: { seulement?: ("nom" | "adresse" | "siret")[] }) {
  const billing = useDataStore((s) => s.billing);
  const setBilling = useDataStore((s) => s.setBilling);
  const stableName = useSettingsStore((s) => s.stableName);
  const [siret, setSiret] = useState(siretDit(billing?.siret));
  const voir = (k: "nom" | "adresse" | "siret") => !seulement || seulement.includes(k);
  const siretOk = siretValide(siret);
  return (
    <div className="fr-form">
      {voir("nom") && (
        <label className="field">
          <span>Nom ou raison sociale</span>
          <input className="input" defaultValue={billing?.legalName ?? ""} placeholder={stableName} autoComplete="organization" onChange={(e) => setBilling({ legalName: e.target.value })} />
          <em>Vide : le nom de ton écurie, « {stableName} ».</em>
        </label>
      )}
      {voir("adresse") && (
        <label className="field">
          <span>Adresse</span>
          <textarea className="input ta fa-adr" rows={3} defaultValue={billing?.address ?? ""} placeholder={"12 chemin des Prés\n72000 Le Mans"} autoComplete="street-address" onChange={(e) => setBilling({ address: e.target.value })} />
        </label>
      )}
      {voir("siret") && (
        <label className="field">
          <span>SIRET</span>
          <input
            className="input"
            inputMode="numeric"
            autoComplete="off"
            value={siret}
            placeholder="14 chiffres"
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d ]/g, "").slice(0, 20);
              setSiret(v);
              setBilling({ siret: siretPropre(v) });
            }}
          />
          <em>{siret && !siretOk ? `${siretPropre(siret).length} chiffres sur 14.` : "Sur ton avis de situation Insee ou ton Kbis."}</em>
        </label>
      )}
    </div>
  );
}

/**
 * La TVA : pas de TVA (franchise), ou un taux par type de prestation choisi
 * parmi 5,5 %, 10 %, 20 %. Rien n'est choisi d'avance.
 */
export function TvaReglage({ kinds = KINDS }: { kinds?: VatKind[] }) {
  const billing = useDataStore((s) => s.billing);
  const setBilling = useDataStore((s) => s.setBilling);
  const vat = billing?.vat;
  return (
    <div className="fr-tva">
      <div className="fr-two" role="radiogroup" aria-label="La TVA sur tes factures">
        <button type="button" role="radio" aria-checked={vat === "franchise"} className={`chip${vat === "franchise" ? " on" : ""}`} onClick={() => setBilling({ vat: "franchise" })}>
          Pas de TVA (franchise)
        </button>
        <button type="button" role="radio" aria-checked={vat === "taux"} className={`chip${vat === "taux" ? " on" : ""}`} onClick={() => setBilling({ vat: "taux" })}>
          Je facture la TVA
        </button>
      </div>
      {vat === "franchise" && <p className="fr-hint">Tes factures diront « {MENTION_FRANCHISE} ».</p>}
      {vat === "taux" && (
        <div className="fr-rates">
          {kinds.map((k) => {
            const cur = billing?.rates?.[k];
            return (
              <div key={k} className="fr-rate">
                <span id={`fr-k-${k}`}>
                  {KIND_LABEL[k]}
                  {!cur && <small> · à choisir</small>}
                </span>
                <div className="chips" role="radiogroup" aria-labelledby={`fr-k-${k}`}>
                  {TAUX.map((t) => (
                    <button key={t} type="button" role="radio" aria-checked={cur === t} className={`chip${cur === t ? " on" : ""}`} onClick={() => setBilling({ rates: { [k]: t } })}>
                      {tauxDit(t)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="fr-hint">Pas sûr ? Le taux dépend de ce que tu vends et de ton statut : demande à ton comptable, puis choisis ici. Tes prix restent ceux que paie le client, TVA comprise.</p>
    </div>
  );
}

/** L'export de l'année pour le comptable : un fichier CSV à ouvrir dans Excel. */
export function ExportComptable() {
  const data = useDataStore();
  const say = useUiStore((s) => s.say);
  const now = new Date().getFullYear();
  const annees = useMemo(() => anneesComptables(data, now), [data, now]);
  const [an, setAn] = useState(annees.includes(now - 1) && new Date().getMonth() < 3 ? now - 1 : now);
  const n = useMemo(() => lignesComptables(data, an).length, [data, an]);
  const telecharger = () => {
    const blob = new Blob([csvComptable(data, an)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `be-stable-comptable-${an}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    say(`Le tableau de ${an} est dans tes téléchargements.`);
  };
  return (
    <div className="fr-exp">
      <div className="chips" role="radiogroup" aria-label="L’année">
        {annees.map((y) => (
          <button key={y} type="button" role="radio" aria-checked={an === y} className={`chip${an === y ? " on" : ""}`} onClick={() => setAn(y)}>
            {y}
          </button>
        ))}
      </div>
      <button type="button" className="btn full" onClick={telecharger} disabled={!n}>
        <Ic n="download" className="" />
        Télécharger le tableau de {an}
      </button>
      <p className="fr-hint">
        {n ? `${n} ligne${n > 1 ? "s" : ""}. ` : "Rien de noté en " + an + ". "}
        Un fichier qui s’ouvre dans Excel : date, recette ou dépense, catégorie, libellé, cheval, client, montant TTC, moyen de paiement, numéro de facture. Les paiements reçus sont à part, en « Encaissement » : ne les ajoute pas aux recettes.
      </p>
    </div>
  );
}
