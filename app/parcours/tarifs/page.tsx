"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Face, Ic, Tip } from "@/components/carnet/ui";
import { ObHead } from "@/components/bs/ob-head";
import { useParcours } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { localToday } from "@/lib/utils/local-date";

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

  return (
    <>
      <ObHead retour={retour} n={2} title="Tes tarifs" sub="Ce que chaque propriétaire te paie par mois. Ensuite, la pension est comptée toute seule chaque mois." />
      <div className="ar-lines">
        {horses.map((h) => (
          <div key={h.id} className="ar-ln">
            <Face horse={h} />
            <span>
              <b>{h.name}</b>
              <small>{h.pensionType ?? "Pension"}</small>
            </span>
            <input className="inl" inputMode="numeric" defaultValue={h.pension ?? ""} placeholder="0" aria-label={`Pension de ${h.name}, euros par mois`} onChange={(e) => setPension(h.id, Number(e.target.value.replace(",", ".")) || 0, month)} />
            <i>€</i>
          </div>
        ))}
      </div>
      <p className="ar-h5">Tes autres prix</p>
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
            <input className="inl" inputMode="numeric" defaultValue={tariffs[k] ?? ""} placeholder="0" aria-label={`${l}, euros`} onChange={(e) => setTariff(k, Number(e.target.value.replace(",", ".")) || undefined)} />
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
          if (!retour) pass("tarifs");
          router.push(retour ? `/${retour}` : "/parcours/factures");
        }}
      >
        {retour ? "Enregistrer" : missing ? `Continuer avec ${missing} pension${missing > 1 ? "s" : ""} à 0 €` : "Passer à l’étape suivante"}
        <Ic n="ck" className="" />
      </button>
    </>
  );
}
