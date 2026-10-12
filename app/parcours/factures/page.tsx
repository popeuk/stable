"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, Tip, eur } from "@/components/bs/ui";
import { Picto, pictoForLabel } from "@/components/bs/picto";
import { ObHead } from "@/components/bs/ob-head";
import { useParcours } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { currentPeriod } from "@/lib/utils/period";
import { recurringDue } from "@/lib/domain/recurring";

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
    <Screen>
      <ObHead retour={retour} n={3} title="Tes frais communs" sub="Les dépenses qui servent à toute l’écurie : foin, paille, loyer, salaires… Tu les notes une fois. Elles sont comptées chaque mois et partagées entre tes chevaux." />
      <div style={{ marginTop: 6 }}>
        {cats.map((c) => (
          <div key={c.id} className="bs-li">
            <span className="bs-pic">
              <Picto name={pictoForLabel(c.name)} />
            </span>
            <span className="tx">
              <b>{c.name}</b>
              <span>par mois, à peu près</span>
            </span>
            <input className="bs-inline" inputMode="numeric" defaultValue={Math.round(amountOf(c.id)) || ""} placeholder="0" aria-label={`${c.name}, euros par mois`} onChange={(e) => setMonthlyCharge(c.id, c.name, Number(e.target.value.replace(",", ".")) || 0, period)} />
            <span className="bs-p" style={{ margin: 0 }}>€</span>
          </div>
        ))}
      </div>
      <p className="bs-p" style={{ marginTop: 12, fontWeight: 600, color: "var(--ink-1)" }}>
        Total par mois : {eur(total)}
      </p>
      <Tip>Un ordre d’idée suffit. Tu pourras corriger ces montants quand tu veux, depuis « Mon écurie et mes réglages » dans le menu.</Tip>
      <button
        type="button"
        className="bs-btn"
        style={{ marginTop: 16 }}
        onClick={() => {
          (document.activeElement as HTMLElement | null)?.blur();
          if (!retour) pass("factures");
          router.push(retour ? `/${retour}` : "/parcours");
        }}
      >
        {retour ? "Enregistrer" : "Terminer cette étape"} <Picto name="check" />
      </button>
    </Screen>
  );
}
