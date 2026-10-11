"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, Sec, Tip } from "@/components/bs/ui";
import { Picto } from "@/components/bs/picto";
import { ObHead } from "@/components/bs/ob-head";
import { HorseFace } from "@/components/bs/horse-face";
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
    <Screen>
      <ObHead retour={retour} n={2} title="Tes tarifs" sub="Ce que chaque propriétaire te paie par mois. La pension se poste ensuite toute seule, chaque mois." />
      <div style={{ marginTop: 8 }}>
        {horses.map((h) => (
          <div key={h.id} className="bs-li">
            <HorseFace horse={h} size={38} />
            <span className="tx">
              <b>{h.name}</b>
              <span>{h.pensionType ?? "Pension"}</span>
            </span>
            <input className="bs-inline" inputMode="numeric" defaultValue={h.pension ?? ""} placeholder="0" aria-label={`Pension de ${h.name}, euros par mois`} onChange={(e) => setPension(h.id, Number(e.target.value.replace(",", ".")) || 0, month)} />
            <span className="bs-p" style={{ margin: 0 }}>€</span>
          </div>
        ))}
      </div>
      <Sec>Tes autres prix</Sec>
      {(
        [
          ["cours_collectif", "Cours collectif", "par cavalier"],
          ["cours_individuel", "Cours particulier", "la séance"],
          ["entrainement", "Travail du cheval", "la séance"],
        ] as const
      ).map(([k, l, s]) => (
        <div key={k} className="bs-li">
          <span className="bs-pic">
            <Picto name="cours" />
          </span>
          <span className="tx">
            <b>{l}</b>
            <span>{s}</span>
          </span>
          <input className="bs-inline" inputMode="numeric" defaultValue={tariffs[k] ?? ""} placeholder="0" aria-label={`${l}, euros`} onChange={(e) => setTariff(k, Number(e.target.value.replace(",", ".")) || undefined)} />
          <span className="bs-p" style={{ margin: 0 }}>€</span>
        </div>
      ))}
      <Tip>Ces prix se préremplissent quand tu notes un cours. Tu peux toujours les changer au cas par cas.</Tip>
      <button
        type="button"
        className="bs-btn"
        style={{ marginTop: 18 }}
        onClick={() => {
          (document.activeElement as HTMLElement | null)?.blur();
          if (!retour) pass("tarifs");
          router.push(retour ? `/${retour}` : "/parcours/factures");
        }}
      >
        {retour ? "Enregistrer" : missing ? `Barre passée, ${missing} pension${missing > 1 ? "s" : ""} à 0 €` : "Barre passée"} <Picto name="check" />
      </button>
    </Screen>
  );
}
