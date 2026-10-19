"use client";

import { useMemo, useState } from "react";
import { Ic } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import {
  DELAIS_PRO,
  KINDS,
  KIND_LABEL,
  MENTION_FRANCHISE,
  PENALITES,
  TAUX,
  enteteVendeur,
  ibanDit,
  ibanErreur,
  ibanPropre,
  personneDe,
  siretDit,
  siretPropre,
  siretValide,
  tauxDit,
  tvaIntraDuSiret,
  tvaIntraPropre,
  tvaIntraValide,
  type ClientManque,
  type VendeurManque,
} from "@/lib/domain/facture";
import { prenomDe } from "@/lib/domain/clients";
import { localToday } from "@/lib/utils/local-date";
import { anneesComptables, csvComptable, lignesComptables } from "@/lib/domain/comptable";
import type { PersonRole, VatKind } from "@/lib/domain/types";

/**
 * Les infos de facturation de l'écurie et le tableau du comptable, partagés
 * entre l'écran Factures (/facturation) et la facture elle-même quand il
 * manque quelque chose. Styles : app/carnet/facture.css (fr-).
 */

/** Nom ou raison sociale (obligatoire), statut (EI ou société, forme et capital), adresse, SIRET (le même que celui du registre), IBAN (facultatif). */
export function InfosVendeur({ seulement }: { seulement?: VendeurManque[] }) {
  const billing = useDataStore((s) => s.billing);
  const siretLieu = useDataStore((s) => s.holding?.siret);
  const setBilling = useDataStore((s) => s.setBilling);
  const [siret, setSiret] = useState(siretDit(billing?.siret || siretLieu));
  const voir = (k: VendeurManque) => !seulement || seulement.includes(k);
  const siretOk = siretValide(siret);
  return (
    <div className="fr-form">
      {voir("nom") && (
        <>
          <label className="field">
            <span>Nom ou raison sociale</span>
            <input className="input" defaultValue={billing?.legalName ?? ""} placeholder="Ex. : Écurie des Prés, ou ton nom" autoComplete="organization" onChange={(e) => setBilling({ legalName: e.target.value })} />
            <em>Tel qu’il est inscrit au répertoire Sirene. Il s’imprime en tête de chaque facture.</em>
          </label>
        </>
      )}
      {(voir("statut") || voir("forme") || voir("capital")) && <StatutVendeur />}
      {voir("adresse") && (
        <label className="field">
          <span>Adresse</span>
          <textarea className="input ta fa-adr" rows={3} defaultValue={billing?.address ?? ""} placeholder={"Ex. : 12 chemin des Prés\n72000 Le Mans"} autoComplete="street-address" onChange={(e) => setBilling({ address: e.target.value })} />
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
            placeholder="Ex. : 123 456 789 00012"
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d ]/g, "").slice(0, 20);
              setSiret(v);
              setBilling({ siret: siretPropre(v) });
            }}
          />
          <em>{siret && !siretOk ? `${siretPropre(siret).length} chiffres sur 14.` : "Sur ton avis de situation Insee ou ton Kbis. Le même que celui de ton registre d’élevage."}</em>
        </label>
      )}
      {voir("tva") && !voir("nom") && <TvaIntra />}
      {!seulement && <Iban />}
    </div>
  );
}

/**
 * Entrepreneur individuel ou société : la loi demande « EI » après le nom
 * d'un entrepreneur individuel, la forme juridique et le capital d'une
 * société. Choisi une fois, imprimé sur chaque facture.
 */
function StatutVendeur() {
  const billing = useDataStore((s) => s.billing);
  const setBilling = useDataStore((s) => s.setBilling);
  const statut = billing?.statut;
  const nom = billing?.legalName?.trim();
  return (
    <>
      <div className="fr-rate">
        <span id="fr-statut-v">Ton statut</span>
        <div className="fr-two" role="radiogroup" aria-labelledby="fr-statut-v">
          <button type="button" role="radio" aria-checked={statut === "ei"} className={`chip${statut === "ei" ? " on" : ""}`} onClick={() => setBilling({ statut: "ei" })}>
            Entrepreneur individuel (micro)
          </button>
          <button type="button" role="radio" aria-checked={statut === "societe"} className={`chip${statut === "societe" ? " on" : ""}`} onClick={() => setBilling({ statut: "societe" })}>
            Société (EARL, SCEA, SARL…)
          </button>
        </div>
      </div>
      {statut === "ei" && <p className="fr-hint">La loi demande « EI » après ton nom : tes factures diront « {enteteVendeur({ name: nom || "Ton nom", ei: true }).nom} ».</p>}
      {statut === "societe" && (
        <>
          <label className="field">
            <span>Forme juridique</span>
            <input className="input" defaultValue={billing?.forme ?? ""} placeholder="Ex. : EARL" autoComplete="off" onChange={(e) => setBilling({ forme: e.target.value.trim() || undefined })} />
          </label>
          <label className="field">
            <span>Capital</span>
            <input className="input" inputMode="decimal" defaultValue={billing?.capital ?? ""} placeholder="Ex. : 7 500 €" autoComplete="off" onChange={(e) => setBilling({ capital: e.target.value.trim() || undefined })} />
            <em>Sur tes statuts ou ton Kbis. Imprimé sous ton nom : « EARL au capital de 7 500 € ».</em>
          </label>
        </>
      )}
    </>
  );
}

/** L'IBAN, facultatif : imprimé en pied de facture pour être payé par virement. */
function Iban() {
  const billing = useDataStore((s) => s.billing);
  const setBilling = useDataStore((s) => s.setBilling);
  const [v, setV] = useState(ibanDit(billing?.iban));
  const erreur = ibanErreur(v);
  return (
    <label className="field">
      <span>
        Ton IBAN <span className="ch-opt">facultatif</span>
      </span>
      <input
        className="input"
        autoComplete="off"
        autoCapitalize="characters"
        value={v}
        placeholder="Ex. : FR76 3000 6000 0112 3456 7890 189"
        aria-invalid={!!erreur}
        onChange={(e) => {
          const t = e.target.value.slice(0, 44);
          setV(t);
          setBilling({ iban: ibanPropre(t) || undefined });
        }}
      />
      <em>{erreur ? `${erreur} Tant qu’il n’est pas juste, il ne s’imprime pas.` : "Rempli, il s’imprime en bas de tes factures : « Paiement par virement : IBAN … ». Un IBAN d’une autre banque d’Europe (N26, Revolut…) marche aussi."}</em>
    </label>
  );
}

/** Le numéro de TVA intracommunautaire, demandé dès qu'on facture la TVA. */
function TvaIntra() {
  const billing = useDataStore((s) => s.billing);
  const siretLieu = useDataStore((s) => s.holding?.siret);
  const setBilling = useDataStore((s) => s.setBilling);
  const [v, setV] = useState(billing?.tvaIntra ?? "");
  const ok = tvaIntraValide(v);
  const memeSiren = tvaIntraDuSiret(v, billing?.siret || siretLieu);
  return (
    <label className="field">
      <span>Ton numéro de TVA intracommunautaire</span>
      <input
        className="input"
        autoComplete="off"
        autoCapitalize="characters"
        value={v}
        placeholder="Ex. : FR 12 345678901"
        onChange={(e) => {
          setV(e.target.value.slice(0, 20));
          setBilling({ tvaIntra: tvaIntraPropre(e.target.value) || undefined });
        }}
      />
      <em>{v && !ok ? "FR, puis 2 chiffres ou lettres, puis les 9 chiffres de ton SIREN." : ok && !memeSiren ? "Ses 9 derniers chiffres ne sont pas ceux de ton SIRET : vérifie-le." : "Il s’imprime sur tes factures avec TVA. Tu le trouves sur ton espace impots.gouv.fr."}</em>
    </label>
  );
}

/**
 * La TVA : pas de TVA (franchise), ou un taux par type de prestation choisi
 * parmi 5,5 %, 10 %, 20 %. Rien n'est choisi d'avance. Avec la TVA, le
 * numéro de TVA intracommunautaire.
 */
export function TvaReglage({ kinds = KINDS }: { kinds?: VatKind[] }) {
  const billing = useDataStore((s) => s.billing);
  const setBilling = useDataStore((s) => s.setBilling);
  const vat = billing?.vat;
  return (
    <div className="fr-tva">
      <div className="fr-two" role="radiogroup" aria-label="La TVA sur tes factures">
        <button type="button" role="radio" aria-checked={vat === "franchise"} className={`chip${vat === "franchise" ? " on" : ""}`} onClick={() => setBilling({ vat: "franchise" })}>
          Sans TVA
        </button>
        <button type="button" role="radio" aria-checked={vat === "taux"} className={`chip${vat === "taux" ? " on" : ""}`} onClick={() => setBilling({ vat: "taux" })}>
          Avec TVA
        </button>
      </div>
      {vat === "franchise" && <p className="fr-hint">Franchise en base : tes factures diront « {MENTION_FRANCHISE} ».</p>}
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
          <TvaIntra />
        </div>
      )}
      <p className="fr-hint">Un doute ? Le taux dépend de ce que tu vends et de ton statut : demande à ton comptable, puis choisis ici. Tes prix restent ceux que paie le client, TVA comprise.</p>
    </div>
  );
}

/** « Avec tes clients, tu dis tu ou vous ? » : choisi une fois, pour les messages de facture et de relance. Vous par défaut. */
export function TuVous() {
  const tutoie = useDataStore((s) => s.billing?.tutoie);
  const setBilling = useDataStore((s) => s.setBilling);
  return (
    <div className="fr-tva">
      <div className="fr-rate">
        <span id="fr-tuvous">Avec tes clients, tu dis tu ou vous ?</span>
        <div className="fr-two" role="radiogroup" aria-labelledby="fr-tuvous">
          <button type="button" role="radio" aria-checked={!!tutoie} className={`chip${tutoie ? " on" : ""}`} onClick={() => setBilling({ tutoie: true })}>
            Tu
          </button>
          <button type="button" role="radio" aria-checked={!tutoie} className={`chip${!tutoie ? " on" : ""}`} onClick={() => setBilling({ tutoie: undefined })}>
            Vous
          </button>
        </div>
      </div>
      <p className="fr-hint">{tutoie ? "« Bonjour Claire, voici ta facture n° … »" : "« Bonjour Claire, voici votre facture n° … »"} Le message qui part avec la facture suit ce choix.</p>
    </div>
  );
}

/**
 * Pour un client professionnel, la loi demande sur la facture la date
 * d'échéance et le taux des pénalités de retard. L'app ne les choisit pas :
 * le gérant le fait une fois.
 */
export function ConditionsPro() {
  const billing = useDataStore((s) => s.billing);
  const setBilling = useDataStore((s) => s.setBilling);
  const d = billing?.delaiPro;
  const p = billing?.penalites;
  return (
    <div className="fr-tva">
      <div className="fr-rate">
        <span id="fr-delai">Il paie</span>
        <div className="chips" role="radiogroup" aria-labelledby="fr-delai">
          {DELAIS_PRO.map((n) => (
            <button key={n} type="button" role="radio" aria-checked={d === n} className={`chip${d === n ? " on" : ""}`} onClick={() => setBilling({ delaiPro: n })}>
              {n ? `Sous ${n} jours` : "À réception"}
            </button>
          ))}
        </div>
      </div>
      <div className="fr-rate">
        <span id="fr-pen">Pénalités en cas de retard</span>
        <div className="fr-two" role="radiogroup" aria-labelledby="fr-pen">
          {PENALITES.map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={p === k} className={`chip${p === k ? " on" : ""}`} onClick={() => setBilling({ penalites: k })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <p className="fr-hint">Sans accord écrit avec ton client, la loi prévoit 30 jours et le taux BCE + 10 points. Les factures à un professionnel disent aussi l’indemnité de 40 € pour frais de recouvrement et l’absence d’escompte.</p>
    </div>
  );
}

/** Particulier ou professionnel, et son adresse : la facture le demande une fois par client. */
export function ClientFacture({ nom, role, manque }: { nom: string; role: PersonRole; manque: ClientManque[] }) {
  const person = useDataStore((s) => personneDe(s, nom));
  const setClient = useDataStore((s) => s.setClientFacture);
  const statut = person?.statut;
  const qui = prenomDe(nom);
  return (
    <div className="fr-form">
      <div className="fr-rate">
        <span id="fr-statut">{qui} est</span>
        <div className="fr-two" role="radiogroup" aria-labelledby="fr-statut">
          <button type="button" role="radio" aria-checked={statut === "particulier"} className={`chip${statut === "particulier" ? " on" : ""}`} onClick={() => setClient(nom, role, { statut: "particulier" })}>
            Un particulier
          </button>
          <button type="button" role="radio" aria-checked={statut === "pro"} className={`chip${statut === "pro" ? " on" : ""}`} onClick={() => setClient(nom, role, { statut: "pro" })}>
            Un professionnel
          </button>
        </div>
      </div>
      {statut && (
        <label className="field">
          <span>Son adresse{statut === "pro" ? "" : ", si tu l’as"}</span>
          <textarea className="input ta fa-adr" rows={2} defaultValue={person?.address ?? ""} placeholder={"Ex. : 3 allée des Saules\n72000 Le Mans"} autoComplete="off" onChange={(e) => setClient(nom, role, { address: e.target.value })} />
          <em>{statut === "pro" ? "Obligatoire sur la facture d’un professionnel." : "Elle s’imprime sous son nom."}</em>
        </label>
      )}
      {statut === "pro" && manque.includes("conditions") && <ConditionsPro />}
    </div>
  );
}

/** L'export de l'année pour le comptable : un fichier CSV à ouvrir dans Excel, jusqu'à aujourd'hui. */
export function ExportComptable() {
  const data = useDataStore();
  const say = useUiStore((s) => s.say);
  const today = localToday();
  const now = Number(today.slice(0, 4));
  const annees = useMemo(() => anneesComptables(data, now), [data, now]);
  const [an, setAn] = useState(annees.includes(now - 1) && Number(today.slice(5, 7)) <= 3 ? now - 1 : now);
  const n = useMemo(() => lignesComptables(data, an, today).length, [data, an, today]);
  const telecharger = () => {
    const blob = new Blob([csvComptable(data, an, today)], { type: "text/csv;charset=utf-8" });
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
        {n ? `${n} ligne${n > 1 ? "s" : ""}, jusqu’à aujourd’hui. ` : "Rien de noté en " + an + ". "}
        Un fichier pour Excel, à donner à ton comptable : une ligne par recette, dépense, paiement et avoir. Seulement ce qui a vraiment eu lieu : tes frais estimés n’y sont pas.
      </p>
    </div>
  );
}
