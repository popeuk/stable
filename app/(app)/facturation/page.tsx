"use client";

import Link from "next/link";
import { useState } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Hello, Ic, Page as Ecran, Sec } from "@/components/carnet/ui";
import { ConditionsPro, ExportComptable, InfosVendeur, TuVous, TvaReglage } from "@/components/bs/facturation";
import { useDataStore } from "@/stores/data-store";
import { useOuChiffres } from "@/components/bs/ou-chiffres";
import { lienFacture, numerosEnDouble } from "@/lib/domain/numeros";
import { conditionsProManquent, enteteVendeur, etatAnnulation, eur2, facturation, moisDit, nomDoc, vendeurDe, vendeurManque } from "@/lib/domain/facture";

/**
 * Tes factures (`/facturation`) : d'abord les factures et avoirs faits, puis
 * ce qui s'imprime sur chaque facture (nom ou raison sociale, statut,
 * adresse, SIRET, IBAN, TVA, conditions pour un professionnel), replié une fois
 * rempli, et le tableau de l'année pour le comptable (`#comptable`). On y
 * arrive depuis Réglages et depuis l'historique de Mon bilan. Styles :
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
  const ou = useOuChiffres();
  const invoices = useDataStore((s) => s.invoices);
  const billing = useDataStore((s) => s.billing);
  const holding = useDataStore((s) => s.holding);
  const b = facturation({ billing, holding });
  const rempli = vendeurManque(b).length === 0 && !!b.vat;
  const [ouvert, setOuvert] = useState(() => !rempli);
  const list = [...(invoices ?? [])].sort((a, c) => Number(!!c.provisoire) - Number(!!a.provisoire) || c.year - a.year || c.seq - a.seq);
  const pro = !conditionsProManquent(b);
  const doubles = numerosEnDouble(invoices);
  const attente = (invoices ?? []).filter((i) => i.provisoire).length;
  return (
    <Ecran className="fr-pg">
      <Hello title="Tes factures" sub="Tes factures, ce qui est imprimé dessus, et le tableau de l’année pour ton comptable." />
      <Sec title="Tes factures faites" blk delay={0.08}>
        {doubles.map((d) => (
          <div key={d.number} className="card fa-card" role="alert">
            <b>
              {d.factures.length} factures portent le n° {d.number}
            </b>
            <p>
              Elles ont été faites en même temps sur ton téléphone et ton ordinateur (
              {d.factures.map((f, k) => (
                <span key={f.id}>
                  {k > 0 && (k === d.factures.length - 1 ? " et " : ", ")}
                  <Link className="lnk" href={`/facture?id=${encodeURIComponent(f.id)}`}>
                    {f.kind === "avoir" ? "avoir" : "facture"} de {f.payer}
                  </Link>
                </span>
              ))}
              ). Garde celle qui est partie la première ; annule l’autre par un avoir, puis refais-la depuis la fiche du client.
            </p>
          </div>
        ))}
        {attente > 0 && <p className="fr-hint">{attente > 1 ? `${attente} factures à numéroter` : "Une facture à numéroter"} : faites sans réseau, elles reçoivent leur numéro dès qu’il revient.</p>}
        {list.length ? (
          <div className="fr-list">
            {list.map((i) => (
              <Link key={i.id} href={doubles.some((d) => d.number === i.number) ? `/facture?id=${encodeURIComponent(i.id)}` : lienFacture(i)} className="fr-inv">
                <span>
                  <b>{nomDoc(i)}</b>
                  <small>
                    {i.payer} · {i.kind === "avoir" && i.avoirDe ? `sur la facture n° ${i.avoirDe.number}` : moisDit(i.month)}
                    {etatAnnulation(i, invoices) && <> · <em className="fr-annulee">{etatAnnulation(i, invoices)}</em></>}
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
        <p className="fr-hint">Une facture faite ne se modifie plus. Pour la corriger, ouvre-la et annule-la avec un avoir. Les numéros se suivent, on ne revient jamais en arrière.</p>
        <p className="fr-hint">
          {ou.compte
            ? "Avant de donner un numéro, l’app relit ta copie en ligne : le téléphone et l’ordinateur ne prennent pas le même. Sans réseau, la facture est faite, à numéroter."
            : "Fais toujours tes factures sur le même téléphone (ou le même ordinateur) : sans compte, ils ne se les partagent pas, et deux factures pourraient avoir le même numéro."}
        </p>
      </Sec>
      <Sec title="Sur tes factures" blk delay={0.14}>
        {rempli && (
          <button type="button" className="li np fr-fold" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}>
            <span>
              <b>{ouvert ? "Replier" : "Modifier"}</b>
              <small>
                {enteteVendeur(vendeurDe(b, b.vat === "franchise")).nom} · {b.vat === "franchise" ? "sans TVA" : "avec TVA"}
                {b.iban ? " · IBAN noté" : ""}
                {pro ? " · conditions pour les pros notées" : ""}
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
        <p className="fr-hint">Tout vient de ce que tu as noté ici. Fais vérifier une fois par ton comptable.</p>
      </Sec>
      <Sec title="Tes messages aux clients" blk delay={0.17} id="messages">
        <TuVous />
      </Sec>
      <Sec title="Pour ton comptable" blk delay={0.2} id="comptable">
        <ExportComptable />
      </Sec>
      <div className="end" />
    </Ecran>
  );
}
