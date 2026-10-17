"use client";

import Link from "next/link";
import { useState } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Hello, Ic, Page as Ecran, Sec } from "@/components/carnet/ui";
import { ConditionsPro, ExportComptable, InfosVendeur, TvaReglage } from "@/components/bs/facturation";
import { useDataStore } from "@/stores/data-store";
import { conditionsProManquent, eur2, facturation, moisDit, nomDoc, vendeurManque } from "@/lib/domain/facture";

/**
 * Tes factures (`/facturation`) : d'abord les factures et avoirs faits, puis
 * ce qui s'imprime sur chaque facture (nom ou raison sociale, forme,
 * adresse, SIRET, TVA, conditions pour un professionnel), replié une fois
 * rempli, et le tableau de l'année pour le comptable (`#comptable`). On y
 * arrive depuis Réglages et depuis l'historique de Mon mois. Styles :
 * app/carnet/facture.css.
 */
export default function Page() {
  return (
    <ClientGate>
      <Facturation />
    </ClientGate>
  );
}

function Facturation() {
  const invoices = useDataStore((s) => s.invoices);
  const billing = useDataStore((s) => s.billing);
  const holding = useDataStore((s) => s.holding);
  const b = facturation({ billing, holding });
  const rempli = vendeurManque(b).length === 0 && !!b.vat;
  const [ouvert, setOuvert] = useState(() => !rempli);
  const list = [...(invoices ?? [])].sort((a, c) => c.year - a.year || c.seq - a.seq);
  const pro = !conditionsProManquent(b);
  return (
    <Ecran className="fr-pg">
      <Hello title="Tes factures" sub="Tes factures faites, ce qui s’imprime sur chacune, et le tableau de l’année pour ton comptable." />
      <Sec title="Tes factures faites" blk delay={0.08}>
        {list.length ? (
          <div className="fr-list">
            {list.map((i) => (
              <Link key={i.id} href={`/facture?n=${encodeURIComponent(i.number)}`} className="fr-inv">
                <span>
                  <b>{nomDoc(i)}</b>
                  <small>
                    {i.payer} · {i.kind === "avoir" && i.avoirDe ? `sur la facture n° ${i.avoirDe.number}` : moisDit(i.month)}
                  </small>
                </span>
                <span className="fr-amt">{eur2(i.totalTTC)}</span>
                <Ic n="chev" className="chev" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="fr-hint">
            Pas encore de facture. Tu la fais depuis{" "}
            <Link className="lnk" href="/chevaux?vue=clients">
              tes clients
            </Link>
            .
          </p>
        )}
        <p className="fr-hint">Une facture faite ne change plus : pour la corriger, ouvre-la et annule-la par un avoir. Les numéros se suivent sans jamais revenir.</p>
        <p className="fr-hint">
          Fais tes factures depuis un seul appareil. Tant que l’app ne partage pas tes factures entre ton téléphone et ton ordinateur, chacun compterait ses numéros de son côté, et deux factures pourraient porter le même.
        </p>
      </Sec>
      <Sec title="Sur tes factures" blk delay={0.14}>
        {rempli && (
          <button type="button" className="li np fr-fold" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}>
            <span>
              <b>{ouvert ? "Replier" : "Modifier"}</b>
              <small>
                {b.legalName}
                {b.forme ? ` ${b.forme}` : ""} · {b.vat === "franchise" ? "sans TVA" : "avec TVA"}
                {pro ? " · conditions pour un professionnel choisies" : ""}
              </small>
            </span>
            <Ic n="chev" className={`chev rg-rot${ouvert ? " on" : ""}`} />
          </button>
        )}
        {ouvert && (
          <div className="fr-reg">
            <InfosVendeur />
            <h3 className="fr-sub">La TVA</h3>
            <TvaReglage />
            <h3 className="fr-sub">Pour un client professionnel</h3>
            <ConditionsPro />
          </div>
        )}
        <p className="fr-hint">Chaque mention s’appuie sur ce que tu as noté ici. Fais-les valider une fois par ton comptable : l’app ne remplace pas son avis.</p>
      </Sec>
      <Sec title="Pour ton comptable" blk delay={0.2} id="comptable">
        <ExportComptable />
      </Sec>
      <div className="end" />
    </Ecran>
  );
}
