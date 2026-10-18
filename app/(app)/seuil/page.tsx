"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { dec1 } from "@/components/bs/ui";
import { SeuilGrid } from "@/components/bs/seuil-grid";
import { useParcours } from "@/components/bs/parcours";
import { Hello, Ic, Page, Tip, eur } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { estAuGerant, monthBreakdown, seuilEtPlaces } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";
import { chevauxDuMois } from "@/lib/domain/presence";
import { REVOIR_PRIX, ilFautPensions, memePlein, phraseSeuil } from "@/lib/domain/lecture";

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
  // Les chevaux de ce mois, comme Mon bilan (un cheval parti dans le mois y compte encore).
  const horses = useMemo(() => chevauxDuMois(data, currentPeriod()), [data]);
  // Le seuil se compte en pensions : les chevaux du gérant prennent une place, sans pension.
  const pensions = horses.filter((h) => !estAuGerant(h));
  const miens = horses.filter(estAuGerant);
  const n = pensions.length;
  const free = Math.max(0, capacity - data.horses.filter((h) => !h.isArchived).length);
  const ok = isFinite(m.seuil);
  const places = seuilEtPlaces(m, capacity);
  // Même toutes les places pleines, le seuil n'est pas atteint : c'est le prix des pensions.
  const horsPlaces = ok && !places.atteignable;
  const above = ok && n >= m.seuil;
  const besoin = ok ? Math.ceil(m.seuil - 1e-9) : 0;
  return (
    <Page>
      <h1 className="ar-sr">Combien de chevaux pour ne pas perdre d’argent ?</h1>
      {/* La réponse en une phrase ; le pourquoi et le calcul attendent dans « Comment on le sait ? ». */}
      <Hello
        title={
          horsPlaces ? (
            memePlein(capacity, eur(places.manque))
          ) : ok ? (
            <>
              {ilFautPensions(m.seuil)}
              <br />
              Tu en as {n}.
            </>
          ) : (
            "Pas possible avec tes prix d’aujourd’hui."
          )
        }
        sub={horsPlaces ? REVOIR_PRIX : phraseSeuil(m.seuil, n)}
      />

      <div className="card rise" style={{ animationDelay: ".14s", margin: "16px var(--gut) 0" }}>
        <p className="k">
          {capacity ? `Tes ${Math.max(capacity, horses.length)} place${Math.max(capacity, horses.length) > 1 ? "s" : ""}` : `Tes ${horses.length} cheva${horses.length > 1 ? "ux" : "l"}`}
        </p>
        <SeuilGrid horses={pensions} miens={miens} capacity={capacity} seuil={horsPlaces ? Infinity : m.seuil} horsPlaces={horsPlaces} />
      </div>

      <details className="ar-how rise" style={{ animationDelay: ".22s" }}>
        <summary>
          Comment on le sait ?
          <Ic n="chev" className="ar-ic" />
        </summary>
        {ok ? (
          <>
            <p className="ar-calc">
              Chaque mois, le foin, le loyer et les salaires tombent, que tu aies peu ou beaucoup de chevaux. Avec moins de {besoin} pensions, tu perds de l’argent. À partir de là, chaque pension en plus te rapporte presque tout son prix.
            </p>
            <p className="ar-calc">
              {m.miens > 0
                ? `Tes pensions doivent payer ${eur(m.aCouvrir)} par mois : les frais de l’écurie, et ce que coûtent tes ${m.miens > 1 ? `${m.miens} chevaux` : "chevaux"} à toi, qui ne paient pas de pension. `
                : `Tes frais de l’écurie font ${eur(m.aCouvrir)} par mois. `}
              Une fois ses soins payés, chaque pension te laisse en moyenne {eur(m.contribution)}. {eur(m.aCouvrir).replace(/\s€$/, "")} divisé par {eur(m.contribution).replace(/\s€$/, "")} : {dec1(m.seuil)}. Il t’en faut donc {besoin} pour tout payer. Tu en as {n}
              {horsPlaces ? `, et ${places.placesPensions} place${(places.placesPensions ?? 0) > 1 ? "s" : ""} pour des pensions` : ""}.
            </p>
          </>
        ) : (
          <p className="ar-calc">Chaque mois, tu paies les frais de l’écurie : foin, paille, loyer, salaires… Il faut assez de pensions pour les payer. Avec plus de chevaux, tu perdrais encore plus. C’est le prix des pensions qu’il faut revoir.</p>
        )}
      </details>

      <div className="pad rise" style={{ animationDelay: ".3s", marginTop: 16 }}>
        {above && free > 0 && (
          <Tip ill="piste">
            <b>
              Tes {free} place{free > 1 ? "s" : ""} libre{free > 1 ? "s sont" : " est"} ta plus grosse piste.
            </b>{" "}
            Tu y es : chaque cheval en plus, c’est presque toute sa pension qui te reste.
          </Tip>
        )}
        {ok && !above && !horsPlaces && (
          <Tip ill="piste">
            <b>Remplir une place ou revoir tes pensions</b> te fait passer au-dessus.
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
