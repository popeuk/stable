"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Back, dec1, ilEnFaut } from "@/components/bs/ui";
import { SeuilGrid } from "@/components/bs/seuil-grid";
import { useParcours } from "@/components/bs/parcours";
import { Hello, Ic, Page, Tip, eur } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";

/** Le seuil : combien de chevaux paient tous les frais communs. */
export default function Page_() {
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
  const n = horses.length;
  const free = Math.max(0, capacity - n);
  const ok = isFinite(m.seuil);
  const above = ok && n >= m.seuil;
  return (
    <Page>
      <Back href={parcours.seuil ? "/argent" : "/parcours"}>{parcours.seuil ? "Bilan" : "Ton parcours · étape 6 sur 6"}</Back>
      <h1 className="ar-sr">Combien de chevaux pour ne pas perdre d’argent ?</h1>
      {ok ? (
        <Hello
          title={
            <>
              {ilEnFaut(m.seuil)}
              <br />
              Tu en as {n}.
            </>
          }
          sub={`Chaque mois, le foin, le loyer et les salaires se paient, quel que soit le nombre de chevaux. En dessous de ${dec1(m.seuil)} pensions, tu perds de l’argent. Au-dessus, chaque cheval en plus te rapporte presque toute sa pension.`}
        />
      ) : (
        <Hello title="Pas encore atteignable." sub="Chaque mois, tu paies des frais communs : foin, paille, loyer, salaires… Il faut un certain nombre de pensions pour les couvrir. Pour l’instant, les pensions ne paient même pas les soins des chevaux." />
      )}

      <div className="card rise" style={{ animationDelay: ".14s", margin: "16px 14px 0" }}>
        <p className="k">
          Tes {Math.max(capacity, n)} box{Math.max(capacity, n) > 1 ? "es" : ""}
        </p>
        <SeuilGrid horses={horses} capacity={capacity} seuil={m.seuil} />
      </div>

      <p className="ar-calc rise" style={{ animationDelay: ".22s" }}>
        {ok
          ? `Tes frais communs font ${eur(m.sharedTotal)} par mois. Une fois ses soins payés, chaque cheval te laisse en moyenne ${eur(m.contribution)}. ${eur(m.sharedTotal).replace(" €", "")} divisé par ${eur(m.contribution).replace(" €", "")} : ${dec1(m.seuil)}. Un demi-cheval ne se loge pas : il t’en faut donc ${Math.ceil(m.seuil - 1e-9)} pour tout payer. Tu en as ${n}.`
          : "Pour l’instant, les pensions ne paient même pas les soins des chevaux. Peu importe leur nombre, tu perds de l’argent. La piste : revoir le prix des pensions."}
      </p>

      <div className="pad rise" style={{ animationDelay: ".3s", marginTop: 16 }}>
        {above && free > 0 && (
          <Tip ill="piste">
            <b>
              Tes {free} box{free > 1 ? "es" : ""} libre{free > 1 ? "s sont" : " est"} ta plus grosse piste.
            </b>{" "}
            Tu es déjà au-dessus du trait : un cheval de plus, c’est presque toute sa pension qui te reste.
          </Tip>
        )}
        {ok && !above && (
          <Tip ill="piste">
            <b>Tu es encore sous le trait.</b> Remplir un box ou revoir tes pensions te fait passer au-dessus.
          </Tip>
        )}
        <Link href="/argent?vue=leviers" className="btn line full" style={{ marginTop: 12 }}>
          Voir les pistes pour gagner plus
        </Link>
        {!parcours.seuil && (
          <button
            type="button"
            className="btn full"
            style={{ marginTop: 10 }}
            onClick={() => {
              const last = pass("seuil");
              if (!last) router.push("/parcours");
            }}
          >
            J’ai compris, étape franchie
            <Ic n="ck" className="" />
          </button>
        )}
      </div>
      <div className="end" />
    </Page>
  );
}
