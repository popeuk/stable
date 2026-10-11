"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Back, Screen, dec1, eur } from "@/components/bs/ui";
import { Picto } from "@/components/bs/picto";
import { SeuilGrid } from "@/components/bs/seuil-grid";
import { useParcours } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";

/** Le seuil : combien de chevaux paient toutes les factures communes. */
export default function Page() {
  return (
    <ClientGate>
      <Seuil />
    </ClientGate>
  );
}

function Seuil() {
  const router = useRouter();
  const data = useDataStore();
  const capacity = useSettingsStore((s) => s.capacity);
  const { parcours, pass } = useParcours();
  const m = useMemo(() => monthBreakdown(data, currentPeriod()), [data]);
  const horses = data.horses.filter((h) => !h.isArchived);
  return (
    <Screen>
      <Back href={parcours.seuil ? "/mois" : "/parcours"}>{parcours.seuil ? "Le mois" : "Parcours · obstacle 6 sur 6"}</Back>
      <h1 className="bs-d bs-t1" style={{ marginTop: 6 }}>
        Le seuil : combien de chevaux paient tout.
      </h1>
      <p className="bs-p">En dessous, tu perds de l’argent chaque mois. Au-dessus, chaque cheval en plus te rapporte presque toute sa pension, parce que les factures communes sont déjà payées.</p>
      <SeuilGrid horses={horses} capacity={capacity} seuil={m.seuil} />
      <p style={{ fontSize: 15.5, fontWeight: 560, lineHeight: 1.45, marginTop: 16 }}>
        {isFinite(m.seuil)
          ? `${eur(m.sharedTotal)} de factures communes ÷ ${eur(m.contribution)} laissés par cheval après ses soins = ${dec1(m.seuil)} chevaux. Tu en as ${horses.length}.`
          : "Tes chevaux ne couvrent pas encore leurs propres soins : le seuil ne peut pas être atteint tant que les pensions ne montent pas."}
      </p>
      {!parcours.seuil && (
        <button
          type="button"
          className="bs-btn"
          style={{ marginTop: 18 }}
          onClick={() => {
            const last = pass("seuil");
            if (!last) router.push("/parcours");
          }}
        >
          J’ai compris, barre passée <Picto name="check" />
        </button>
      )}
    </Screen>
  );
}
