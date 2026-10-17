"use client";

import Link from "next/link";
import { ClientGate } from "@/components/ui/client-gate";
import { Hello, Ic, Page as Ecran, Sec } from "@/components/carnet/ui";
import { ExportComptable, InfosVendeur, TvaReglage } from "@/components/bs/facturation";
import { useDataStore } from "@/stores/data-store";
import { eur2, moisDit } from "@/lib/domain/facture";

/**
 * Tes factures (`/facturation`) : ce qui s'imprime sur chaque facture (nom
 * ou raison sociale, adresse, SIRET, TVA), les factures déjà faites, et le
 * tableau de l'année pour le comptable (`#comptable`). On y arrive depuis
 * Réglages et depuis l'historique de Mon mois. Styles : app/carnet/facture.css.
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
  const list = [...(invoices ?? [])].sort((a, b) => b.year - a.year || b.seq - a.seq);
  return (
    <Ecran className="fr-pg">
      <Hello title="Tes factures" sub="Ce qui s’imprime sur chaque facture, tes factures faites, et le tableau de l’année pour ton comptable." />
      <Sec title="Sur tes factures" blk delay={0.08}>
        <InfosVendeur />
      </Sec>
      <Sec title="La TVA" blk delay={0.14}>
        <TvaReglage />
      </Sec>
      <Sec title="Tes factures faites" blk delay={0.2}>
        {list.length ? (
          <div className="fr-list">
            {list.map((i) => (
              <Link key={i.id} href={`/facture?n=${encodeURIComponent(i.number)}`} className="fr-inv">
                <span>
                  <b>n° {i.number}</b>
                  <small>
                    {i.payer} · {moisDit(i.month)}
                  </small>
                </span>
                <span className="fr-amt">{eur2(i.totalTTC)}</span>
                <Ic n="chev" className="chev" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="fr-hint">
            Pas encore de facture. Tu la fais depuis la fiche d’un client, ou depuis{" "}
            <Link className="lnk" href="/chevaux?vue=clients">
              tes clients
            </Link>
            .
          </p>
        )}
      </Sec>
      <Sec title="Pour ton comptable" blk delay={0.26} id="comptable">
        <ExportComptable />
      </Sec>
      <div className="end" />
    </Ecran>
  );
}
