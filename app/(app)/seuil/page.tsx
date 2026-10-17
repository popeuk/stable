"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { dec1, ilEnFaut } from "@/components/bs/ui";
import { SeuilGrid } from "@/components/bs/seuil-grid";
import { useParcours } from "@/components/bs/parcours";
import { Hello, Ic, Page, Tip, eur } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";
import { chevauxDuMois } from "@/lib/domain/presence";

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
  // Les chevaux de ce mois, comme Mon mois (un cheval parti dans le mois y compte encore).
  const horses = useMemo(() => chevauxDuMois(data, currentPeriod()), [data]);
  const n = horses.length;
  const free = Math.max(0, capacity - data.horses.filter((h) => !h.isArchived).length);
  const ok = isFinite(m.seuil);
  const above = ok && n >= m.seuil;
  return (
    <Page>
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
          sub={`Chaque mois, le foin, le loyer et les salaires tombent, que tu aies peu ou beaucoup de chevaux. Avec moins de ${Math.ceil(m.seuil - 1e-9)} chevaux, tu perds de l’argent. À partir de là, chaque cheval en plus te rapporte presque toute sa pension.`}
        />
      ) : (
        <Hello title="Pas encore atteignable." sub="Chaque mois, tu paies les frais de l’écurie : foin, paille, loyer, salaires… Il faut assez de pensions pour les payer. Pour l’instant, les pensions ne paient même pas les soins des chevaux." />
      )}

      <div className="card rise" style={{ animationDelay: ".14s", margin: "16px 14px 0" }}>
        <p className="k">
          {capacity ? `Tes ${Math.max(capacity, n)} box${Math.max(capacity, n) > 1 ? "es" : ""}` : `Tes ${n} cheva${n > 1 ? "ux" : "l"}`}
        </p>
        <SeuilGrid horses={horses} capacity={capacity} seuil={m.seuil} />
      </div>

      <p className="ar-calc rise" style={{ animationDelay: ".22s" }}>
        {ok
          ? `Tes frais de l’écurie font ${eur(m.sharedTotal)} par mois. Une fois ses soins payés, chaque cheval te laisse en moyenne ${eur(m.contribution)}. ${eur(m.sharedTotal).replace(" €", "")} divisé par ${eur(m.contribution).replace(" €", "")} : ${dec1(m.seuil)}. Il t’en faut donc ${Math.ceil(m.seuil - 1e-9)} pour tout payer. Tu en as ${n}.`
          : "Pour l’instant, les pensions ne paient même pas les soins des chevaux. Avec plus de chevaux, tu perdrais encore plus. C’est le prix des pensions qu’il faut revoir."}
      </p>

      <div className="pad rise" style={{ animationDelay: ".3s", marginTop: 16 }}>
        {above && free > 0 && (
          <Tip ill="piste">
            <b>
              Tes {free} box{free > 1 ? "es" : ""} libre{free > 1 ? "s sont" : " est"} ta plus grosse piste.
            </b>{" "}
            Tu as passé le trait : chaque cheval en plus, c’est presque toute sa pension qui te reste.
          </Tip>
        )}
        {ok && !above && (
          <Tip ill="piste">
            <b>Tu n’as pas encore assez de pensions pour tout payer.</b> Remplir un box ou revoir tes pensions te fait passer au-dessus.
          </Tip>
        )}
        <Link href="/argent?vue=leviers" className="btn line full" style={{ marginTop: 12 }}>
          Voir les idées pour gagner plus
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
            Compris
            <Ic n="ck" className="" />
          </button>
        )}
      </div>
      <div className="end" />
    </Page>
  );
}
