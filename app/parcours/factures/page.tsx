"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Ic, Seg, Tip, eur } from "@/components/carnet/ui";
import { pictoForLabel } from "@/components/bs/picto";
import { MontantMois, ObHead } from "@/components/bs/ob-head";
import { chargeDuMois, fraisDuMois, fraisEnUnTotal, retirerPostes, retirerTotal, useParcours } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { currentPeriod } from "@/lib/utils/period";

/** Les pictos des catégories, dans le jeu d'icônes du carnet. */
const IC: Record<string, string> = { box: "home", fer: "shoe", veto: "syringe", pot: "syringe", main: "user", dent: "syringe", cours: "clock", trophee: "flag", foin: "hay", personne: "user", cle: "home", camion: "arrow", euro: "doc" };

export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <Factures />
      </Suspense>
    </ClientGate>
  );
}

type Mode = "total" | "postes";

/**
 * L'obstacle « frais communs ». Un total (un seul montant, une charge
 * « Frais fixes ») ou poste par poste (catégorie par catégorie). Passer de
 * l'un à l'autre propose de retirer l'autre : rien n'est compté deux fois.
 */
function Factures() {
  const router = useRouter();
  const retour = useSearchParams().get("retour");
  const data = useDataStore();
  const setMonthlyCharge = useDataStore((s) => s.setMonthlyCharge);
  const { pass } = useParcours();
  const period = useMemo(() => currentPeriod(), []);
  const f = fraisDuMois(data, period);
  const [mode, setMode] = useState<Mode>(() => (fraisDuMois(useDataStore.getState(), period).postes > 0 ? "postes" : "total"));
  const [txt, setTxt] = useState(() => String(Math.round(fraisDuMois(useDataStore.getState(), period).total) || ""));
  // Les champs poste par poste se remontent quand un total les vide.
  const [rev, setRev] = useState(0);

  const changerTotal = (v: string) => {
    setTxt(v);
    fraisEnUnTotal(Number(v) || 0, period);
  };

  return (
    <>
      <ObHead retour={retour} n={3} title="Tes frais communs" sub="Les dépenses qui servent à toute l’écurie : foin, paille, loyer, salaires… Elles sont comptées chaque mois et partagées entre tes chevaux." />
      <div className="ar-seg">
        <Seg<Mode>
          label="Comment noter tes frais"
          value={mode}
          onChange={setMode}
          options={[
            ["total", "Un total"],
            ["postes", "Poste par poste"],
          ]}
        />
      </div>

      {mode === "total" ? (
        <>
          <MontantMois id="f-total" label="Foin, loyer, salaires… par mois" value={txt} onChange={changerTotal} help="Un ordre d’idée suffit. Tu affineras plus tard." />
          {f.postes > 0 && (
            <div className="ar-warn" role="status">
              <span>
                Tu as aussi noté <b>{eur(f.postes)}</b> poste par poste. Ils s’ajoutent à ce total.
              </span>
              <button
                type="button"
                className="btn line"
                onClick={() => {
                  retirerPostes(period);
                  setRev((r) => r + 1);
                }}
              >
                Ne garder que le total
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {f.total > 0 && (
            <div className="ar-warn" role="status">
              <span>
                Tu as déjà noté un total de <b>{eur(f.total)}</b>. Avec tes postes, il compterait deux fois.
              </span>
              <button
                type="button"
                className="btn line"
                onClick={() => {
                  retirerTotal(period);
                  setTxt("");
                }}
              >
                Retirer le total
              </button>
            </div>
          )}
          <div className="ar-lines" key={rev}>
            {f.cats.map((c) => (
              <div key={c.id} className="ar-ln">
                <span className="pic">
                  <Ic n={IC[pictoForLabel(c.name)] ?? "doc"} className="ar-ico" />
                </span>
                <span>
                  <b>{c.name}</b>
                  <small>par mois, à peu près</small>
                </span>
                <input
                  className="inl"
                  inputMode="numeric"
                  defaultValue={Math.round(chargeDuMois(data, c.id, period)) || ""}
                  placeholder="0"
                  aria-label={`${c.name}, euros par mois`}
                  onChange={(e) => setMonthlyCharge(c.id, c.name, Number(e.target.value.replace(",", ".")) || 0, period)}
                />
                <i>€</i>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="ar-total">
        <span>Total par mois</span>
        <b>{eur(f.total + f.postes)}</b>
      </div>
      {mode === "postes" && (
        <Tip ill="carnet-buste">
          <b>Un ordre d’idée suffit.</b> Tu pourras corriger ces montants quand tu veux, depuis « Mon écurie et mes réglages ».
        </Tip>
      )}
      <button
        type="button"
        className="btn ar-go"
        onClick={() => {
          (document.activeElement as HTMLElement | null)?.blur();
          if (!retour) pass("factures");
          router.push(retour ? `/${retour}` : "/parcours/arrivee");
        }}
      >
        {retour ? "Enregistrer" : "Voir ce qu’il me reste"}
        <Ic n="ck" className="" />
      </button>
    </>
  );
}
