import { MENTION_FRANCHISE, dateDite, deMois, enteteVendeur, eur2, mentionIban, mentionsPaiement, nomDoc, siretDit, tauxDit, tvaIntraDit } from "@/lib/domain/facture";
import { MENTION_PROVISOIRE } from "@/lib/domain/numeros";
import type { Invoice } from "@/lib/domain/types";

/* La feuille A4 d'une facture ou d'un avoir (styles : app/carnet/facture.css, fa-print). */

/** Ce qui reste à payer d'une facture une fois ses avoirs déduits (pour l'écran, jamais sur la feuille). */
export const resteApresAvoirs = (inv: Invoice, avoirs: Invoice[]) => Math.max(0, Math.round((inv.due - avoirs.reduce((t, a) => t + Math.abs(a.totalTTC), 0)) * 100) / 100);

/**
 * La feuille A4 : noir sur blanc, sobre. C'est elle seule qui part à
 * l'impression. Une facture faite se réimprime à l'identique, même après un
 * avoir (son « Reste à payer » est celui du jour où elle est partie) :
 * l'avoir est un document à part, et l'écran le dit au-dessus.
 */
export function Feuille({ inv, apercu }: { inv: Invoice; apercu?: boolean }) {
  const f = inv.franchise;
  const avoir = inv.kind === "avoir";
  const mentions = mentionsPaiement(inv);
  const entete = enteteVendeur(inv.seller);
  const iban = avoir ? "" : mentionIban(inv.seller.iban);
  return (
    <article className={`fa-print${apercu ? " apercu" : ""}`} aria-label={apercu ? "Aperçu de la facture" : nomDoc(inv)}>
      {apercu && <p className="fa-wm">Aperçu, pas encore de numéro</p>}
      {!apercu && inv.provisoire && <p className="fa-wm">{MENTION_PROVISOIRE}</p>}
      <header className="fa-top">
        <div className="fa-from">
          <b>{entete.nom}</b>
          {entete.sous && <span>{entete.sous}</span>}
          {entete.rcs && <span>{entete.rcs}</span>}
          {inv.seller.address && <span className="fa-pre">{inv.seller.address}</span>}
          {inv.seller.siret && <span>SIRET {siretDit(inv.seller.siret)}</span>}
          {!f && inv.seller.tvaIntra && <span>N° TVA intracommunautaire {tvaIntraDit(inv.seller.tvaIntra)}</span>}
        </div>
        <div className="fa-id">
          <h1>{avoir ? "Avoir" : "Facture"}</h1>
          <span>n° {apercu || inv.provisoire ? "à venir" : inv.number}</span>
          <span>Date : {dateDite(inv.issuedAt)}</span>
          {avoir && inv.avoirDe && (
            <span>
              Sur la facture n° {inv.avoirDe.number} du {dateDite(inv.avoirDe.issuedAt)}
            </span>
          )}
          <span>Prestations {deMois(inv.month)}</span>
        </div>
      </header>
      <div className="fa-to">
        <small>{avoir ? "Pour" : "Facturé à"}</small>
        <b>{inv.buyer.name}</b>
        {inv.buyer.address && <span className="fa-pre">{inv.buyer.address}</span>}
        {inv.buyer.tvaIntra && <span>N° TVA {tvaIntraDit(inv.buyer.tvaIntra)}</span>}
      </div>
      <table className="fa-tbl">
        <thead>
          <tr>
            <th>Désignation</th>
            <th className="n">Qté</th>
            <th className="n">{f ? "Prix unitaire" : "Prix unitaire HT"}</th>
            {!f && <th className="n">TVA</th>}
            <th className="n">{f ? "Total" : "Total HT"}</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l, i) => (
            <tr key={i}>
              <td>{l.label}</td>
              <td className="n">{l.qty}</td>
              <td className="n">{eur2(l.unitHT)}</td>
              {!f && <td className="n">{tauxDit(l.rate)}</td>}
              <td className="n">{eur2(l.totalHT)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="fa-tot">
        {!f && (
          <>
            <div>
              <span>Total HT</span>
              <span>{eur2(inv.totalHT)}</span>
            </div>
            {inv.vat.map((v) => (
              <div key={v.rate}>
                <span>
                  TVA {tauxDit(v.rate)} sur {eur2(v.base)}
                </span>
                <span>{eur2(v.amount)}</span>
              </div>
            ))}
          </>
        )}
        <div className="fa-ttc">
          <span>{avoir ? (f ? "Total de l’avoir" : "Total de l’avoir TTC") : f ? "Total" : "Total TTC"}</span>
          <span>{eur2(inv.totalTTC)}</span>
        </div>
        {!avoir && inv.paid > 0 && (
          <div>
            <span>Déjà payé</span>
            <span>{eur2(inv.paid)}</span>
          </div>
        )}
        {!avoir && (inv.avance ?? 0) > 0 && (
          <div>
            <span>Avance déjà versée</span>
            <span>−{eur2(inv.avance!)}</span>
          </div>
        )}
        {!avoir && (
          <div className="fa-due">
            <span>Reste à payer</span>
            <span>{eur2(inv.due)}</span>
          </div>
        )}
      </div>
      <footer className="fa-foot">
        {f && <p>{MENTION_FRANCHISE}.</p>}
        {mentions.map((m) => (
          <p key={m}>{m}</p>
        ))}
        {iban && <p>{iban}.</p>}
      </footer>
    </article>
  );
}
