"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Face, Ic, Tip } from "@/components/carnet/ui";
import { ObHead } from "@/components/bs/ob-head";
import { changerPensionCommune, pensionCommune, useParcours } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { localToday } from "@/lib/utils/local-date";
import { lireMontant, montantEnTexte, montantOuZero } from "@/lib/utils/montant";

export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <Tarifs />
      </Suspense>
    </ClientGate>
  );
}

function Tarifs() {
  const router = useRouter();
  const retour = useSearchParams().get("retour");
  const allHorses = useDataStore((s) => s.horses);
  const horses = allHorses.filter((h) => !h.isArchived);
  const setPension = useDataStore((s) => s.setPension);
  const tariffs = useDataStore((s) => s.tariffs) ?? {};
  const setTariff = useDataStore((s) => s.setTariff);
  const { pass } = useParcours();
  const month = localToday().slice(0, 7);
  const missing = horses.filter((h) => !h.pension).length;
  // Des chevaux venus d'un nombre partagent une pension : elle est déjà fixée.
  const [commune, setCommune] = useState(() => pensionCommune(useDataStore.getState()));

  return (
    <>
      <ObHead
        retour={retour}
        n={2}
        title="Tes tarifs"
        sub={commune !== null ? "Ta pension est fixée. Ajoute le prix de tes cours, si tu en donnes." : "Ce que chaque propriétaire te paie par mois. Ensuite, la pension est comptée toute seule chaque mois."}
      />
      {commune !== null ? (
        <>
          <div className="ar-lines">
            <div className="ar-ln">
              <span className="pic">
                <Ic n="horse" className="ar-ico" />
              </span>
              <span>
                <b>La pension</b>
                <small className="ar-set">Prix fixé pour {horses.length > 1 ? `tes ${horses.length} chevaux` : "ton cheval"}</small>
              </span>
              <input className="inl" inputMode="decimal" defaultValue={montantEnTexte(commune)} placeholder="0" aria-label="Pension de chaque cheval, euros par mois" onChange={(e) => changerPensionCommune(montantOuZero(e.target.value))} />
              <i>€</i>
            </div>
          </div>
          <button type="button" className="ar-alt" onClick={() => setCommune(null)}>
            Fixer la pension cheval par cheval
          </button>
        </>
      ) : (
        <div className="ar-lines">
          {horses.map((h) => (
            <div key={h.id} className="ar-ln">
              <Face horse={h} />
              <span>
                <b>{h.name}</b>
                <small>{h.pensionType ?? "Pension"}</small>
              </span>
              <input className="inl" inputMode="decimal" defaultValue={montantEnTexte(h.pension)} placeholder="0" aria-label={`Pension de ${h.name}, euros par mois`} onChange={(e) => setPension(h.id, montantOuZero(e.target.value), month)} />
              <i>€</i>
            </div>
          ))}
        </div>
      )}
      <p className="ar-h5">{commune !== null ? "Tes cours" : "Tes autres prix"}</p>
      <div className="ar-lines" style={{ marginTop: 0 }}>
        {(
          [
            ["cours_collectif", "Cours collectif", "par cavalier"],
            ["cours_individuel", "Cours particulier", "la séance"],
            ["entrainement", "Travail du cheval", "la séance"],
          ] as const
        ).map(([k, l, s]) => (
          <div key={k} className="ar-ln">
            <span className="pic">
              <Ic n="clock" className="ar-ico" />
            </span>
            <span>
              <b>{l}</b>
              <small>{s}</small>
            </span>
            <input className="inl" inputMode="decimal" defaultValue={montantEnTexte(tariffs[k])} placeholder="0" aria-label={`${l}, euros`} onChange={(e) => setTariff(k, lireMontant(e.target.value) || undefined)} />
            <i>€</i>
          </div>
        ))}
      </div>
      <Tip ill="carnet-buste">
        <b>Ces prix se remplissent tout seuls</b> quand tu notes un cours. Tu peux toujours les changer juste pour une fois.
      </Tip>
      <button
        type="button"
        className="btn ar-go"
        onClick={() => {
          (document.activeElement as HTMLElement | null)?.blur();
          // Rien de rempli : l'étape est passée, pas franchie (le message ne félicite pas).
          if (!retour) pass("tarifs", !Object.values(useDataStore.getState().tariffs ?? {}).some(Boolean));
          router.push(retour ? `/${retour}` : "/parcours/factures");
        }}
      >
        {retour ? "Enregistrer" : missing && commune === null ? `Continuer avec ${missing} pension${missing > 1 ? "s" : ""} à 0 €` : "Continuer"}
        <Ic n="ck" className="" />
      </button>
    </>
  );
}
