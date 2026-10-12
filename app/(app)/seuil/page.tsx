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

/** Le seuil : combien de chevaux paient tous les frais communs. */
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
      <Back href={parcours.seuil ? "/argent" : "/parcours"}>{parcours.seuil ? "Bilan" : "Ton parcours · étape 6 sur 6"}</Back>
      <h1 className="bs-d bs-t1" style={{ marginTop: 6 }}>
        Combien de chevaux pour ne pas perdre d’argent ?
      </h1>
      <p className="bs-p">Chaque mois, tu paies des frais communs : foin, paille, loyer, salaires… Il faut un certain nombre de pensions pour les couvrir. En dessous, tu perds de l’argent. Au-dessus, chaque cheval en plus te rapporte presque toute sa pension.</p>
      <p className="bs-p">Chaque case est un box. Le trait rose montre où tu arrêtes de perdre de l’argent.</p>
      <SeuilGrid horses={horses} capacity={capacity} seuil={m.seuil} />
      <p style={{ fontSize: 15.5, fontWeight: 560, lineHeight: 1.45, marginTop: 16 }}>
        {isFinite(m.seuil)
          ? `Tes frais communs font ${eur(m.sharedTotal)} par mois. Une fois ses soins payés, chaque cheval te laisse en moyenne ${eur(m.contribution)}. Il t’en faut donc ${dec1(m.seuil)} pour tout payer. Tu en as ${horses.length}.`
          : "Pour l’instant, les pensions ne paient même pas les soins des chevaux. Peu importe leur nombre, tu perds de l’argent. La piste : revoir le prix des pensions."}
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
          J’ai compris, obstacle passé <Picto name="check" />
        </button>
      )}
    </Screen>
  );
}
