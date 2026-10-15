"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Ic, Tip, eur } from "@/components/carnet/ui";
import { pictoForLabel } from "@/components/bs/picto";
import { ObHead } from "@/components/bs/ob-head";
import { useParcours } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { currentPeriod } from "@/lib/utils/period";
import { recurringDue } from "@/lib/domain/recurring";

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

function Factures() {
  const router = useRouter();
  const retour = useSearchParams().get("retour");
  const data = useDataStore();
  const setMonthlyCharge = useDataStore((s) => s.setMonthlyCharge);
  const { pass } = useParcours();
  const period = useMemo(() => currentPeriod(), []);
  const cats = data.expenseCategories.filter((c) => !c.isDirect);

  // Ce que chaque catégorie pèse ce mois-ci : saisies du mois et charges récurrentes.
  const amountOf = (catId: string) =>
    data.sharedExpenses.filter((e) => e.categoryId === catId && e.periodYear === period.year && e.periodMonth === period.month).reduce((t, e) => t + e.totalAmount, 0) +
    (data.recurringExpenses ?? []).filter((r) => r.isShared && r.categoryId === catId && recurringDue(r, period)).reduce((t, r) => t + r.amount, 0);
  const total = cats.reduce((t, c) => t + amountOf(c.id), 0);

  return (
    <>
      <ObHead retour={retour} n={3} title="Tes frais communs" sub="Les dépenses qui servent à toute l’écurie : foin, paille, loyer, salaires… Tu les notes une fois. Elles sont comptées chaque mois et partagées entre tes chevaux." />
      <div className="ar-lines">
        {cats.map((c) => (
          <div key={c.id} className="ar-ln">
            <span className="pic">
              <Ic n={IC[pictoForLabel(c.name)] ?? "doc"} className="ar-ico" />
            </span>
            <span>
              <b>{c.name}</b>
              <small>par mois, à peu près</small>
            </span>
            <input className="inl" inputMode="numeric" defaultValue={Math.round(amountOf(c.id)) || ""} placeholder="0" aria-label={`${c.name}, euros par mois`} onChange={(e) => setMonthlyCharge(c.id, c.name, Number(e.target.value.replace(",", ".")) || 0, period)} />
            <i>€</i>
          </div>
        ))}
      </div>
      <div className="ar-total">
        <span>Total par mois</span>
        <b>{eur(total)}</b>
      </div>
      <Tip ill="carnet-buste">
        <b>Un ordre d’idée suffit.</b> Tu pourras corriger ces montants quand tu veux, depuis « Mon écurie et mes réglages » dans le menu.
      </Tip>
      <button
        type="button"
        className="btn ar-go"
        onClick={() => {
          (document.activeElement as HTMLElement | null)?.blur();
          if (!retour) pass("factures");
          router.push(retour ? `/${retour}` : "/parcours");
        }}
      >
        {retour ? "Enregistrer" : "Terminer cette étape"}
        <Ic n="ck" className="" />
      </button>
    </>
  );
}
